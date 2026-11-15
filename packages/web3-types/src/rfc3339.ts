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

import { formatValue, InvalidResponseError } from '@beatoz/web3-errors';

const rfc3339Matcher =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?((?:[+-]\d{2}:\d{2})|Z)$/;

export function fromRfc3339(str: string): Date {
    const matches = rfc3339Matcher.exec(str);
    if (!matches) {
        throw new InvalidResponseError(
            `a time in the response must be RFC 3339, got ${formatValue(str)}`,
        );
    }

    const year = +matches[1];
    const month = +matches[2];
    const day = +matches[3];
    const hour = +matches[4];
    const minute = +matches[5];
    const second = +matches[6];

    // fractional seconds match either undefined or a string like ".1", ".123456789"
    const milliSeconds = matches[7] ? Math.floor(+matches[7] * 1000) : 0;

    let tzOffsetSign: number;
    let tzOffsetHours: number;
    let tzOffsetMinutes: number;

    // if timezone is undefined, it must be Z or nothing (otherwise the group would have captured).
    if (matches[8] === 'Z') {
        tzOffsetSign = 1;
        tzOffsetHours = 0;
        tzOffsetMinutes = 0;
    } else {
        tzOffsetSign = matches[8].substring(0, 1) === '-' ? -1 : 1;
        tzOffsetHours = +matches[8].substring(1, 3);
        tzOffsetMinutes = +matches[8].substring(4, 6);
    }

    const tzOffset = tzOffsetSign * (tzOffsetHours * 60 + tzOffsetMinutes) * 60; // seconds

    const timestamp =
        Date.UTC(year, month - 1, day, hour, minute, second, milliSeconds) - tzOffset * 1000;
    return new Date(timestamp);
}
