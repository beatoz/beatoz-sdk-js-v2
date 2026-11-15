/*
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
*/

import { hexToBytes } from 'ethereum-cryptography/utils';

const invalidHexData: any[] = [
    'Heeäööä👅D34ɝɣ24Єͽ',
    '',
    '-',
    '-0x',
    'x',
    '0x0x',
    '0xH',
    'I have 100£',
    '\u0000',
    true,
    false,
    '0x407d73d8a49eeb85d32cf465507dd71d507100cG', // Invalid hex character "G"
    {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => {},
    undefined,
];

const invalidHexStrictData: any[] = [
    ...invalidHexData,
    '45',
    '-45',
    '0',
    1,
    BigInt(12),
    BigInt(''),
    BigInt(-255),
    -42,
    4.2,
];

export const validCheckAddressCheckSumData: any[] = [
    '0xc1912fEE45d61C87Cc5EA59DaE31190FFFFf232d',
    '0x52908400098527886E0F7030069857D2E4169EE7',
    '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
    '0x27b1fdb04752bbc536007a920d24acb045561c26',
    '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
    '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
];

export const validAddressData: any[] = [
    '0x344c56e8322d26a07b2b576789359565fa5d09d7',
    '0xc6d9d2cd449a754c494264e1809c50e34d64562b',
    'c6d9d2cd449a754c494264e1809c50e34d64562b',
    '0xE247A45c287191d435A8a5D72A7C8dc030451E9F',
    '0xe247a45c287191d435a8a5d72a7c8dc030451e9f',
    '0xE247A45C287191D435A8A5D72A7C8DC030451E9F',
    '0XE247A45C287191D435A8A5D72A7C8DC030451E9F',
    new Uint8Array(hexToBytes('0xE247A45C287191D435A8A5D72A7C8DC030451E9F')),
];

export const invalidAddressData: any[] = [
    ...invalidHexStrictData,
    '0x1',
    '0xE247a45c287191d435A8a5D72A7C8dc030451E9F', // Invalid checksum
    '-0x407d73d8a49eeb85d32cf465507dd71d507100c1',
];
