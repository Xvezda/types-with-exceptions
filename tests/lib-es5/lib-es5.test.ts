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
  plugin.rules['no-undocumented-throws'],
  {
    valid: [
      {
        code: `
          function foo(): any {
            return JSON.parse("{}");
          }
        `,
      },
    ],
    invalid: [
      {
        code: `
          function foo(text: string): any {
            return JSON.parse(text);
          }
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function foo(text: string): any {
            return JSON.parse(text);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      {
        code: `
          function foo(text: string): any {
            return JSON.parse(\`\${text}\`);
          }
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function foo(text: string): any {
            return JSON.parse(\`\${text}\`);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      {
        code: `
          function foo(code: string): any {
            return eval(code);
          }
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function foo(code: string): any {
            return eval(code);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      }
    ],
  }
);

