const { getWebPackConfig } = require('../../webpack.base.config');

module.exports = getWebPackConfig(
    __dirname,
    'web3-validator.min.js',
    'BeatozWeb3Validator',
    'src/index.ts',
    'tsconfig.json',
);
