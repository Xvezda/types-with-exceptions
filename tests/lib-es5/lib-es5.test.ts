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
      // Basic JSON parsing with constant
      {
        code: `
          function foo(): any {
            return JSON.parse("{}");
          }
        `,
      },
      // Array constructor test cases - Valid scenarios
      {
        code: `
          function createArray(): any[] {
            return new Array(5);
          }
        `,
      },
      // Array constructor with documented throws
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function createArray(length: number): any[] {
            return new Array(length);
          }
        `,
      },
      // Array constructor with number parameter - plugin doesn't require throws documentation
      // for simple typed parameters as they're considered low-risk
      {
        code: `
          function createDynamicArray(size: number): any[] {
            return new Array(size);
          }
        `,
      },
      {
        code: `
          function createEmptyArray(length: number): any[] {
            return Array(length);
          }
        `,
      },
      // RegExp constructor with documented throws
      {
        code: `
          /**
           * @throws {SyntaxError}
           */
          function createRegex(pattern: string): RegExp {
            return new RegExp(pattern);
          }
        `,
      },
      // Function constructor with documented throws
      {
        code: `
          /**
           * @throws {SyntaxError}
           */
          function createFunction(body: string): Function {
            return new Function(body);
          }
        `,
      },
      // Object.create with documented throws
      {
        code: `
          /**
           * @throws {TypeError}
           */
          function createObjectWithProps(proto: object, props: PropertyDescriptorMap): any {
            return Object.create(proto, props);
          }
        `,
      },
      // Number formatting with documented throws
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function formatNumber(num: number, digits: number): string {
            return num.toFixed(digits);
          }
        `,
      },
      // TypedArray constructors with documented throws
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function createTypedArray(size: number): Int8Array {
            return new Int8Array(size);
          }
        `,
      },
      // Date constructor with documented throws
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function createDateFromTimestamp(timestamp: number): Date {
            return new Date(timestamp);
          }
        `,
      },
      // Intl.Collator with documented throws
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function createCollator(locale: string): Intl.Collator {
            return new Intl.Collator(locale);
          }
        `,
      },
      // ArrayBuffer constructor with documented throws
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function createBuffer(size: number): ArrayBuffer {
            return new ArrayBuffer(size);
          }
        `,
      },
      // DataView constructor with documented throws
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function createDataView(buffer: ArrayBuffer): DataView {
            return new DataView(buffer);
          }
        `,
      },
      // Number methods with documented throws
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function formatNumberPrecision(num: number, precision: number): string {
            return num.toPrecision(precision);
          }
        `,
      },
      // Intl.NumberFormat with documented throws
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function createNumberFormat(locale: string): Intl.NumberFormat {
            return new Intl.NumberFormat(locale);
          }
        `,
      },
      // Intl.DateTimeFormat with documented throws
      {
        code: `
          /**
           * @throws {RangeError}
           */
          function createDateTimeFormat(locale: string): Intl.DateTimeFormat {
            return new Intl.DateTimeFormat(locale);
          }
        `,
      },
    ],
    invalid: [
      // JSON parsing with dynamic string input
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
          function bar(text: string): any {
            return JSON.parse(\`\${text}\`);
          }
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function bar(text: string): any {
            return JSON.parse(\`\${text}\`);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      // eval() with dynamic code
      {
        code: `
          function baz(code: string): any {
            return eval(code);
          }
        `,
        output: `
          /**
           * @throws {SyntaxError}
           */
          function baz(code: string): any {
            return eval(code);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      // Array constructor with complex expression that could fail
      {
        code: `
          function createArray(input: string): any[] {
            return new Array(parseInt(input));
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function createArray(input: string): any[] {
            return new Array(parseInt(input));
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      // encodeURI with dynamic input
      {
        code: `
          function encodeUserInput(uri: string): string {
            return encodeURI(uri);
          }
        `,
        output: `
          /**
           * @throws {URIError}
           */
          function encodeUserInput(uri: string): string {
            return encodeURI(uri);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      // decodeURIComponent with dynamic input
      {
        code: `
          function decodeUserComponent(component: string): string {
            return decodeURIComponent(component);
          }
        `,
        output: `
          /**
           * @throws {URIError}
           */
          function decodeUserComponent(component: string): string {
            return decodeURIComponent(component);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      // JSON.stringify with circular references risk
      {
        code: `
          function stringifyObject(obj: any): string {
            return JSON.stringify(obj);
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function stringifyObject(obj: any): string {
            return JSON.stringify(obj);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      // URI decoding functions
      {
        code: `
          function decodeUserInput(uri: string): string {
            return decodeURI(uri);
          }
        `,
        output: `
          /**
           * @throws {URIError}
           */
          function decodeUserInput(uri: string): string {
            return decodeURI(uri);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      // Number formatting with user input
      {
        code: `
          function formatUserNumber(num: number, digits: string): string {
            return num.toFixed(parseInt(digits));
          }
        `,
        output: `
          /**
           * @throws {RangeError}
           */
          function formatUserNumber(num: number, digits: string): string {
            return num.toFixed(parseInt(digits));
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      // Object.create with complex properties
      {
        code: `
          function createObjectWithProps(proto: object, props: any): any {
            return Object.create(proto, props);
          }
        `,
        output: `
          /**
           * @throws {TypeError}
           */
          function createObjectWithProps(proto: object, props: any): any {
            return Object.create(proto, props);
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
      // ArrayBuffer with dynamic size
      // {
      //   code: `
      //     function createBuffer(input: string): ArrayBuffer {
      //       return new ArrayBuffer(parseInt(input));
      //     }
      //   `,
      //   output: `
      //     /**
      //      * @throws {TypeError}
      //      */
      //     function createBuffer(input: string): ArrayBuffer {
      //       return new ArrayBuffer(parseInt(input));
      //     }
      //   `,
      //   errors: [{
      //     messageId: 'missingThrowsTag'
      //   }],
      // },
      // Number.toString with dynamic radix
      {
        code: `
          function convertNumberBase(num: number, base: string): string {
            return num.toString(parseInt(base));
          }
        `,
        output: `
          /**
           * @throws {RangeError}
           */
          function convertNumberBase(num: number, base: string): string {
            return num.toString(parseInt(base));
          }
        `,
        errors: [{
          messageId: 'missingThrowsTag'
        }],
      },
    ],
  }
);

