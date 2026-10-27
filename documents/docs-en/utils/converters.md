# web3-utils converters

## Table of Contents
- [BeatozUnitMap](#BeatozUnitMap)
- [BytesToUint8Array](#BytesToUint8Array)
- [BytesToHex](#BytesToHex)
- [HexToBytes](#HexToBytes)
- [HexToNumber](#HexToNumber)
- [ToDecimal](#ToDecimal)
- [NumberToHex](#NumberToHex)
- [FromDecimal](#FromDecimal)
- [Utf8ToHex](#FromDecimal)
- [FromUtf8](#FromUtf8)
- [StringToHex](#StringToHex)
- [HexToUtf8](#HexToUtf8)
- [ToUtf8](#ToUtf8)
- [HexToAscii](#HexToAscii)
- [ToAscii](#ToAscii)
- [ToNumber](#ToNumber)
- [ToBigInt](#ToBigInt)
- [FromWei](#FromWei)
- [ToWei](#ToWei)
- [ToChecksumAddress](#ToChecksumAddress)

---

### BeatozUnitMap

A hashtable that stores the ratio between different units of BEATOZ.

Below one BEATOZ the units are `wei`, `kwei`, `mwei`, `gwei`, `szabo` and `finney`.

```ts
export const beatozUnitMap = {
    nobeatoz: BigInt('0'),
    wei: BigInt(1),
    kwei: expo10(3),
    mwei: expo10(6),
    gwei: expo10(9),
    szabo: expo10(12),
    finney: expo10(15),
    beatoz: expo10(18),
    // ...
    tbeatoz: expo10(30),
};
```

### BytesToUint8Array

This method converts an instance of `Bytes` into an instance of `Uint8Array`.

```ts
export const bytesToUint8Array = (data: Bytes): Uint8Array | never => {...}
```

### BytesToHex

This method converts an instance of `Bytes` into a `HexString`.

```ts
export const bytesToHex = (bytes: Bytes): HexString => {...}
```

### HexToBytes

This method converts an instance of `HexString` into `Bytes`.

```ts
export const hexToBytes = (bytes: HexString): Uint8Array => {...}
```

### HexToNumber

This method converts an instance of `HexString` into a number.

```ts
export const hexToNumber = (value: HexString): bigint | number => {...}
```

### ToDecimal

Alias for `hexToNumber`.

```ts
export const toDecimal = hexToNumber;
```

### NumberToHex

This method converts a number into a `HexString`.

```ts
export const numberToHex = (value: Numbers, hexstrict?: boolean): HexString => {...}
```

### FromDecimal

Alias for `numberToHex`.

```ts
export const fromDecimal = numberToHex;
```

### Utf8ToHex

This method converts a string into a `HexString`.

```ts
export const utf8ToHex = (str: string): HexString => {...}
```

### FromUtf8

Alias for `utf8ToHex`.

```ts
export const fromUtf8 = utf8ToHex;
```

### StringToHex

Alias for `utf8ToHex`.

```ts
export const stringToHex = utf8ToHex;
```

### HexToUtf8

This method converts a `HexString` into a string.

```ts
export const hexToUtf8 = (str: HexString): string => {...}
```

### ToUtf8

This method converts an input (which can be `HexString` or `Uint8Array`) into a UTF-8 string.

```ts
export const toUtf8 = (input: HexString | Uint8Array) => {...}
```

### HexToAscii

This method converts a `HexString` into an ASCII string.

```ts
export const hexToAscii = (str: HexString): string => {...}
```

### ToAscii

Alias for `hexToAscii`.

```ts
export const toAscii = hexToAscii;
```

### ToNumber

This method converts a `Numbers` value into a number or bigint representation.

```ts
export const toNumber = (value: Numbers): bigint|number => {...}
```

### ToBigInt

This method converts any given value into its bigint representation.

```ts
export const toBigInt = (value: unknown): bigint => {...}
```

### FromWei

This method converts a given number in wei into any other BEATOZ unit.

```ts
export const fromWei = (number: Numbers, unit: BeatozUnits): string => {...}
```

### ToWei

This method converts a given number from a specified BEATOZ unit into wei.

```ts
export const toWei = (number: Numbers, unit: BeatozUnits): string => {...}
```

### ToChecksumAddress

This method converts an address to a checksum address.

```ts
export const toChecksumAddress = (address: Address): string => {...}
```
