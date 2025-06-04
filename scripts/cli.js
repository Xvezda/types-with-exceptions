import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { parse } from 'yaml';
import npmFetch from 'npm-registry-fetch';
import tar from 'tar-fs';
import gunzip from 'gunzip-maybe';
import { program, Argument } from 'commander';

const projectRoot =
  path.resolve(path.join(import.meta.dirname), '..');

process.chdir(projectRoot);

const registryYaml = fs.readFileSync('registry.yaml', 'utf8');

const registryYamlParsed = parse(registryYaml);

program
  .addArgument(
    new Argument('<command>', 'command to run')
      .choices(['sync', 'diff', 'clean', 'help'])
  )
  .action((command) => {
    switch (command) {
      case 'sync':
        sync();
        break;
      case 'diff':
        diff();
        break;
      case 'clean':
        clean();
        break;
      case 'help':
      default:
        program.help();
    }
  });

program.parse(process.argv);

async function clean() {
  fs.rm('.cache', { recursive: true, force: true }, (err) => {
    if (err) {
      console.error(`Failed to clean cache: ${err.message}`);
    } else {
      console.log('Cache cleaned successfully.');
    }
  });
}

async function diff() {
  for (const [name, meta] of Object.entries(registryYamlParsed)) {
    let cacheDir, packageName;
    if (
      typeof meta === 'object' &&
      meta?.copy && typeof meta.copy === 'object'
    ) {
      const dir = path.join('.cache', meta.from.substring('npm:'.length));
      const dest = path.join('.cache', name);

      for (const [destPath, src] of Object.entries(meta.copy)) {
        const srcPath = path.join(dir, src);
        const destFullPath = path.join(dest, destPath);
        if (!fs.existsSync(path.dirname(destFullPath))) {
          await fsPromises.mkdir(path.dirname(destFullPath), { recursive: true });
        }
        await fsPromises.cp(srcPath, destFullPath);
      }

      const requiredFiles = [
        ...fs.globSync('package.json', { cwd: dir }),
        ...fs.globSync('README*', { cwd: dir }),
        ...fs.globSync('NOTICE*', { cwd: dir }),
        ...fs.globSync('LICEN[SC]E*', { cwd: dir }),
      ];
      for (const filename of requiredFiles) {
        await fsPromises.cp(
          path.join(dir, filename),
          path.join(dest, filename),
        );
      }
      packageName = meta.from.substring('npm:'.length);
      cacheDir = dest;
    } else {
      packageName = meta.substring('npm:'.length);
      cacheDir = path.join('.cache', packageName);
    }

    const typeDir = path.join('types', name);
    const patchFile = path.join('patches', `${name}.patch`);
    if (!fs.existsSync(cacheDir)) {
      console.error(`Cache directory for ${name} does not exist.`);
      return;
    }
    const diffProcess = spawn('diff', ['-ruN', cacheDir, typeDir], {
      stdio: ['pipe', 'pipe', process.stderr],
    });

    let output = '';
    diffProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    await new Promise((resolve, reject) => {
      diffProcess.on('close', (code) => {
        if (code !== 0 && code !== 1) {
          reject(new Error(`Diff process exited with code ${code}`));
        } else if (code === 1) {
          fs.writeFile(patchFile, output, (err) => {
            if (err) {
              reject(new Error(`Failed to write patch file: ${err.message}`));
            } else {
              console.log(`Patch file created: ${patchFile}`);
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    });
  }
}

async function sync() {
  for (const [name, meta] of Object.entries(registryYamlParsed)) {
    const from = typeof meta === 'string'
      ? meta
      : meta.from;

    if (from?.startsWith('npm:')) {
      const dir = await npm(name, from.substring('npm:'.length));
      const dest = path.join('types', name);

      const patchFile = path.join('patches', `${name}.patch`);
      if (fs.existsSync(patchFile)) {
        const stream = fs.createReadStream(patchFile);

        const patchProcess = spawn('patch', ['-d', dir], {
          stdio: ['pipe', process.stdout, process.stderr],
        });
        stream.pipe(patchProcess.stdin);

        await new Promise((resolve, reject) => {
          patchProcess.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`Patch process exited with code ${code}`));
            } else {
              resolve();
            }
          });
        });
      }
      await fsPromises.rm(dest, { recursive: true, force: true });
      await fsPromises.mkdir(dest, { recursive: true });

      if (
        typeof meta === 'object' &&
        meta?.copy && typeof meta.copy === 'object'
      ) {
        for (const [destPath, src] of Object.entries(meta.copy)) {
          const srcPath = path.join(dir, src);
          const destFullPath = path.join(dest, destPath);
          if (!fs.existsSync(path.dirname(destFullPath))) {
            await fsPromises.mkdir(path.dirname(destFullPath), { recursive: true });
          }
          await fsPromises.cp(srcPath, destFullPath);
        }

        const requiredFiles = [
          ...fs.globSync('package.json', { cwd: dir }),
          ...fs.globSync('README*', { cwd: dir }),
          ...fs.globSync('NOTICE*', { cwd: dir }),
          ...fs.globSync('LICEN[SC]E*', { cwd: dir }),
        ];
        for (const filename of requiredFiles) {
          await fsPromises.cp(
            path.join(dir, filename),
            path.join(dest, filename),
          );
        }
      } else {
        await fsPromises.cp(dir, dest, { recursive: true });
      }
    }
  }
}

/**
 * @param {string} name
 * @param {string} packageName
 * @return {Promise<string>} The directory where the package is extracted.
 */
async function npm(name, packageName) {
  const registry = await npmFetch.json(`/${packageName}`);
  const latestVersion = registry['dist-tags']['latest'];

  const latestInfo = registry.versions[latestVersion];

  const cacheDir = '.cache';
  const tarballDir  = path.join(cacheDir, '.tarballs');
  const extractDir = path.join(cacheDir, packageName);

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const tarballUrl = new URL(latestInfo.dist.tarball);
  const tarballName = path.basename(tarballUrl.pathname);
  if (!fs.existsSync(path.join(tarballDir, tarballName))) {
    const response = await fetch(tarballUrl);

    if (!fs.existsSync(tarballDir)) {
      fs.mkdirSync(tarballDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(tarballDir, tarballName),
      Buffer.from(await response.arrayBuffer())
    );
  }

  if (!fs.existsSync(extractDir)) {
    fs.mkdirSync(extractDir, { recursive: true });
  }

  const prefixDir = registry.name.includes('/')
    ? registry.name.split('/').pop()
    : 'package';

  const stream = fs.createReadStream(path.join(tarballDir, tarballName))
    .pipe(gunzip())
    .pipe(tar.extract(extractDir, {
      ignore(name) {
        return (
          !path.basename(name).endsWith('.d.ts') &&
          !/LICEN[CS]E/i.test(path.basename(name)) &&
          !/README/i.test(path.basename(name)) &&
          !/NOTICE/i.test(path.basename(name)) &&
          path.basename(name) !== 'package.json'
        );
      },
      map(header) {
        if (header.name.startsWith(`${prefixDir}/`)) {
          header.name =
            header.name.substring(`${prefixDir}/`.length);
        }
        return header;
      },
    }));

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(extractDir));
    stream.on('error', reject);
  });
}
