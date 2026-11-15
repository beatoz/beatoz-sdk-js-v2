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
import { ReconnectingSocket } from '../../../src/socket/reconnecting_socket';
import { ConnectionStatus } from '../../../src/socket/queueing_streaming_socket';
import { getTestWsServer } from '../e2e_utils';

describe('ReconnectingSocket', () => {
    let socket: ReconnectingSocket;
    let disconnected = false;

    // A test that fails before its own disconnect(), or reconnects after it,
    // leaves a socket that keeps Jest from exiting (#88). Close it only then:
    // a second disconnect() can throw.
    afterAll(() => {
        if (!disconnected || socket.connectionStatus.value !== ConnectionStatus.Disconnected) {
            socket.disconnect();
        }
    });

    it('stays disconnected after disconnect()', async () => {
        socket = new ReconnectingSocket(getTestWsServer());
        socket.connect();
        await socket.connectionStatus.waitFor(ConnectionStatus.Connected);

        socket.disconnect();
        disconnected = true;

        // The first reconnect attempt is scheduled 100ms after a drop. Wait
        // well past it, so "did not reconnect" is not "has not yet".
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(socket.connectionStatus.value).toEqual(ConnectionStatus.Disconnected);
    });
});
