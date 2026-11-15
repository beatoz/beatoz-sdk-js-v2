# Javascript(Typescript) SDK for BEATOZ

`beatoz-sdk-js` is Javascript(Typescript) SDK for BEATOZ blockhcain network.

## Prerequisite

To build use typescript compiler,

```bash
npm install yarn -g
```

To generate typescript sources for protobuf messages,

```bash
brew install protobuf
```

To compile typescript sources,

```bash
node -v
v19.5.0
```

```bash
npm -v
9.4.1
```

## Usages

### Install SDK

```bash
npm install @beatoz/web3
```

### Build sources

```bash
git clone https://github.com/beatoz/beatoz-sdk-js-v2.git
cd beatoz-sdk-js-v2
npm install

npm run build 
```

### In a browser

`@beatoz/web3` ships a bundle that sets one global, `BeatozWeb3`, holding the
same names an `import` from the package gives:

```html
<script src="https://unpkg.com/@beatoz/web3/dist/web3.min.js"></script>
<script>
    // As `import { Web3, TrxProtoBuilder } from '@beatoz/web3'`
    const { Web3, TrxProtoBuilder } = BeatozWeb3;
    const web3 = new Web3('https://rpc1.testnet.beatoz.io');
</script>
```

Pin a version in production (`@beatoz/web3@2.0.0`). `@beatoz/web3-validator`
ships `dist/web3-validator.min.js` the same way, as `BeatozWeb3Validator`. A
build of the repository writes both to each package's `dist/`.

---

### Documentation / API-Document 

You can find documents https://beatoz.gitbook.io/beatoz-sdk-js/docs-en

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [`guides/`](./guides) for development, commit, issue and pull request rules, [the release policy](./guides/release.md) for versioning, and [SECURITY.md](./SECURITY.md) for reporting a vulnerability.

## License
```
Copyright 2023 All BEATOZ Developers

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
