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
  .action(async (command) => {
    switch (command) {
      case 'sync':
        sync();
        break;
      case 'diff':
        for (const [name] of Object.entries(registryYamlParsed)) {
          await diff(name);
        } 
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

async function diff(name) {
  const cacheDir = await setupCache(name);

  const typeDir = path.join('types', name);
  const patchFile = path.join('patches', `${name}.patch`);

  if (!fs.existsSync(cacheDir)) {
    console.error(`Cache directory for ${name} does not exist.`);
    return;
  }

  const diffProcess = spawn('diff', ['-ruN', cacheDir, typeDir], {
    stdio: ['pipe', 'pipe', 'inherit'],
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

async function sync() {
  for (const [name, meta] of Object.entries(registryYamlParsed)) {
    const from = typeof meta === 'string'
      ? meta
      : meta.from;

    if (!from.startsWith('npm:')) {
      throw new Error(`Invalid package source for ${name}: ${from}`);
    }

    const packageName = from.substring('npm:'.length);
    const _extractPath = await npm(packageName);

    const cacheDir = await setupCache(name);
    const typesDir = path.join('types', name);

    if (fs.existsSync(typesDir)) {
      await diff(name);
    }

    const patchFile = path.join('patches', `${name}.patch`);
    if (fs.existsSync(patchFile)) {
      const stream = fs.createReadStream(patchFile);

      const patchProcess = spawn('patch', ['-d', cacheDir], {
        stdio: ['pipe', 'inherit', 'inherit'],
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
    await fsPromises.rm(typesDir, { recursive: true, force: true });
    await fsPromises.mkdir(typesDir, { recursive: true });

    await fsPromises.cp(cacheDir, typesDir, { recursive: true });
  }
}

async function setupCache(name) {
  const meta = registryYamlParsed[name];
  const cachePath = path.join('.cache', name);
  const packageName =
    typeof meta === 'string'
      ? meta.substring('npm:'.length)
      : meta.from.substring('npm:'.length);
  const packagePath = path.join('.cache', packageName);

  if (!fs.existsSync(cachePath)) {
    await fsPromises.mkdir(cachePath);
  }

  if (typeof meta === 'string') {
    await fsPromises.cp(packagePath, cachePath, { recursive: true });
    return cachePath;
  }

  if (!meta.copy || typeof meta.copy !== 'object') {
    throw new Error('Invalid metadata for package: ' + name);
  }

  for (const [dest, src] of Object.entries(meta.copy)) {
    const srcPath = path.join(packagePath, src);
    const destPath = path.join(cachePath, dest);
    if (!fs.existsSync(path.dirname(destPath))) {
      await fsPromises.mkdir(path.dirname(destPath), { recursive: true });
    }
    await fsPromises.cp(srcPath, destPath);
  }

  const requiredFiles = [
    ...fs.globSync('package.json', { cwd: packagePath }),
    ...fs.globSync(['NOTICE*', 'Notice*', 'notice*'], { cwd: packagePath }),
    ...fs.globSync(['LICEN[SC]E*', 'Licen[sc]e*', 'licen[sc]e*'], { cwd: packagePath }),
  ];
  for (const filename of requiredFiles) {
    await fsPromises.cp(
      path.join(packagePath, filename),
      path.join(cachePath, filename),
    );
  }
  return cachePath;
}

/**
 * @param {string} name
 * @param {string} packageName
 * @return {Promise<string>} The directory where the package is extracted.
 */
async function npm(packageName) {
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
