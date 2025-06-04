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

ruleTester.run(
  'no-undocumented-throws',
  // @ts-expect-error - incompatible
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
