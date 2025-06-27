# types-with-exceptions [![Sync](https://github.com/Xvezda/types-with-exceptions/actions/workflows/sync.yml/badge.svg)](https://github.com/Xvezda/types-with-exceptions/actions/workflows/sync.yml)

This project is designed to enable the JSDoc `@throws` type-checking and documentation-enforcement rules provided by [eslint-plugin-explicit-exceptions](https://github.com/Xvezda/eslint-plugin-explicit-exceptions) to be used with frequently used functions and libraries.

## Usage

```sh
# For @types/*, i.e. @types/node
npm install --save-dev @types-with-exceptions/node
# For built-in lib replacement
npm install --save-dev @types-with-exceptions/lib
```
`tsconfig.json`
```diff
 {
    // ...
+   "typeRoots": [
+     "node_modules/@types",
+     "node_modules/@types-with-exceptions"
+   ],
+   "libReplacement": true,
    // ...
 }
```

## Contributing

You can either open an issue to request work or create a PR with your changes.

**To open an issue:**
Click [New issue](https://github.com/Xvezda/types-with-exceptions/issues/new), then include the target package name and example code in your issue.

**To submit a PR:**
Follow the steps below.

1. Fork repository
1. Check if the package you want to modify exists in the `types` directory.
   1. If it does not exist, add the desired package to the [`registry.yaml` file](https://github.com/Xvezda/types-with-exceptions?tab=readme-ov-file#registryyaml).
   1. Run `pnpm run sync` to apply the changes.
1. Modify the relevant `*.d.ts` file(s) in the `types` directory and commit.
1. (Optional) Add tests in the `tests` directory. Refer to [rule-tester](https://typescript-eslint.io/packages/rule-tester).
1. [Create a PR](https://github.com/Xvezda/types-with-exceptions/compare).

### [`/registry.yaml`](https://github.com/Xvezda/types-with-exceptions/blob/main/registry.yaml)

```yaml
# Simplified
node: 'npm:@types/node'
# ^1   ^2  ^3

# 1: The top-level key is used as the package name. For instance, `node` becomes `@types-with-exceptions/node`
# 2: Specifies where to fetch the package from. (Currently, only npm is supported.)
# 3: Package name


# Advanced
lib-es5:
  from: 'npm:typescript'
  #     ^1
  copy:
    'index.d.ts': 'lib/lib.es5.d.ts'
    # ^2          ^3
# 1: Same as simplified version above
# 2: Destination file name
# 3: Source file name
# And to comply with the license, README, LICENSE, etc. are copied by default without needing to specify them separately.
```
