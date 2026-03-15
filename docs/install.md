# Installation

## Package Managers

::: code-group

```sh [bun]
bun install --dev ts-printers
# or globally
bun add --global ts-printers
```

```sh [npm]
npm install --save-dev ts-printers
# or globally
npm i -g ts-printers
```

```sh [pnpm]
pnpm add --save-dev ts-printers
```

```sh [yarn]
yarn add --dev ts-printers
```

:::

## Prerequisites

- **Bun** >= 1.3 (runtime)
- **p7zip** (only needed for automated HP firmware updates)

```sh
brew install p7zip  # macOS
```

## Binaries

Standalone binaries are available for each platform:

::: code-group

```sh [macOS (arm64)]
curl -L https://github.com/stacksjs/ts-printers/releases/latest/download/print-darwin-arm64 -o print
chmod +x print
mv print /usr/local/bin/print
```

```sh [macOS (x64)]
curl -L https://github.com/stacksjs/ts-printers/releases/latest/download/print-darwin-x64 -o print
chmod +x print
mv print /usr/local/bin/print
```

```sh [Linux (arm64)]
curl -L https://github.com/stacksjs/ts-printers/releases/latest/download/print-linux-arm64 -o print
chmod +x print
mv print /usr/local/bin/print
```

```sh [Linux (x64)]
curl -L https://github.com/stacksjs/ts-printers/releases/latest/download/print-linux-x64 -o print
chmod +x print
mv print /usr/local/bin/print
```

```sh [Windows (x64)]
curl -L https://github.com/stacksjs/ts-printers/releases/latest/download/print-windows-x64.exe -o print.exe
```

:::
