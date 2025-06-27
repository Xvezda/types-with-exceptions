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
    valid: [],
    invalid: [
      {
        code: `
          function* gen() {}

          function foo() {
            const g = gen();
            g.throw(new Error());
          }
        `,
        output: `
          function* gen() {}

          /**
           * @throws {any}
           */
          function foo() {
            const g = gen();
            g.throw(new Error());
          }
        `,
        errors: [{ messageId: 'missingThrowsTag' }],
      },
    ],
  }
);

