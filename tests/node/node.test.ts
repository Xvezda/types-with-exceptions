import { RuleTester } from '@typescript-eslint/rule-tester';
import plugin from 'eslint-plugin-explicit-exceptions';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      tsconfigRootDir: import.meta.dirname,
      projectService: {
        allowDefaultProject: ['*.ts*'],
      },
      JSDocParsingMode: 'all',
    },
  },
});

// Test for fs module functions that should have @throws documentation
ruleTester.run(
  'fs-sync-functions-throws-documentation',
  plugin.rules['no-undocumented-throws'],
  {
    valid: [
      // Test functions that already have proper @throws documentation
      {
        code: `
          /**
           * @throws {NodeJS.ErrnoException} When file operations fail
           */
          function testRename() {
            const fs = require('fs');
            fs.renameSync('old.txt', 'new.txt');
          }
        `,
      },
      {
        code: `
          /**
           * @throws {NodeJS.ErrnoException} When file operations fail
           */
          function testReadFile() {
            const fs = require('fs');
            return fs.readFileSync('test.txt');
          }
        `,
      },
      {
        code: `
          /**
           * @throws {NodeJS.ErrnoException} When file operations fail
           */
          function testWriteFile() {
            const fs = require('fs');
            fs.writeFileSync('test.txt', 'data');
          }
        `,
      },
      {
        code: `
          /**
           * @throws {NodeJS.ErrnoException} When file operations fail
           */
          function testUnlink() {
            const fs = require('fs');
            fs.unlinkSync('test.txt');
          }
        `,
      },
      {
        code: `
          /**
           * @throws {NodeJS.ErrnoException} When directory operations fail
           */
          function testMkdir() {
            const fs = require('fs');
            fs.mkdirSync('testdir');
          }
        `,
      },
      {
        code: `
          /**
           * @throws {NodeJS.ErrnoException} When copy operations fail
           */
          function testCopy() {
            const fs = require('fs');
            fs.copyFileSync('src.txt', 'dest.txt');
          }
        `,
      },
      {
        code: `
          /**
           * @throws {NodeJS.ErrnoException} When access checks fail
           */
          function testAccess() {
            const fs = require('fs');
            fs.accessSync('test.txt');
          }
        `,
      },
    ],
    invalid: [
      // Test more basic case - JSON.parse with dynamic input should fail without @throws
      {
        code: `
          function testJsonParseMissingThrows(input: string) {
            return JSON.parse(input);
          }
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function testJsonParseMissingThrows(input: string) {
            return JSON.parse(input);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
    ],
  }
);

// Test for original functionality
ruleTester.run(
  'no-undocumented-throws',
  plugin.rules['no-undocumented-throws'],
  {
    valid: [],
    invalid: [
      {
        code: `
          const abortController = new AbortController();
          async function fetchApi(path: string): Promise<any> {
            return await fetch('https://example.com' + path, {
              signal: abortController.signal,
            });
          }
        `,
        output: `
          const abortController = new AbortController();
          /**
           * @throws {Promise<DOMException>}
           */
          async function fetchApi(path: string): Promise<any> {
            return await fetch('https://example.com' + path, {
              signal: abortController.signal,
            });
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      }
    ],
  }
);
