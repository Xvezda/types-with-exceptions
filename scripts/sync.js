import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { parse } from 'yaml';
import npmFetch from 'npm-registry-fetch';
import tar from 'tar-fs';
import gunzip from 'gunzip-maybe';

const projectRoot =
  path.resolve(path.join(import.meta.dirname), '..');

const registryYaml =
  fs.readFileSync(path.join(projectRoot, 'registry.yaml'), 'utf8');

const registryYamlParsed = parse(registryYaml);

for (const [name, meta] of Object.entries(registryYamlParsed)) {
  if (meta?.from.startsWith('npm:')) {
    const dir = await npm(meta.from.substring('npm:'.length));
    const dest = path.join(projectRoot, 'types', name);
    await fsPromises.rm(dest, { recursive: true, force: true });
    await fsPromises.rename(dir, dest);
  }
}

/**
 * @param {string} packageName
 * @return {Promise<string>} The directory where the package is extracted.
 */
async function npm(packageName) {
  const registry = await npmFetch.json(`/${packageName}`);
  const latestVersion = registry['dist-tags']['latest'];

  const latestInfo = registry.versions[latestVersion];

  const cacheDir = path.join(projectRoot, '.cache');
  const tarballDir  = path.join(cacheDir, '.tarballs');
  const extractDir = path.join(cacheDir, registry.name);

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir);
  }

  const tarballUrl = new URL(latestInfo.dist.tarball);
  const response = await fetch(tarballUrl);
  const tarballName = path.basename(tarballUrl.pathname);

  if (!fs.existsSync(tarballDir)) {
    fs.mkdirSync(tarballDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(tarballDir, tarballName),
    Buffer.from(await response.arrayBuffer())
  );

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
          !name.endsWith('.d.ts') &&
          !name.endsWith('.d.ts.map') &&
          /^LICEN[CS]E/i.test(path.basename(name)) &&
          /^README/i.test(path.basename(name)) &&
          /^NOTICE/i.test(path.basename(name)) &&
          path.basename(name) === 'package.json'
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
