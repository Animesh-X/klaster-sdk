import { ChainId, Token } from '@uniswap/sdk-core';
import { Pair } from '@uniswap/v2-sdk';
import { ethers } from 'ethers';

const ALCHEMY_URL = 'https://eth-sepolia.g.alchemy.com/v2/v1Jr-KUNg7WP49AuX4dBn1ycnjhoWDWG';
const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_URL);
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const WETH_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const chainId = ChainId.SEPOLIA;

const uniswapV2PairABI = [
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)"
];

const init = async () => {
    try {
        const ETH = new Token(chainId, WETH_ADDRESS, 18, 'SETH', 'Sepolia ETH');
        const USDC = new Token(chainId, USDC_ADDRESS, 6, 'USDC', 'USD Coin');

        const pairAddress = Pair.getAddress(ETH, USDC);
        console.log(`Pair Address: ${pairAddress}`);

        // Check if the pair contract exists at this address
        const code = await provider.getCode(pairAddress);
        if (code === '0x') {
            throw new Error(`No contract found at ${pairAddress}. Ensure the pair exists on Sepolia.`);
        }

        const pairContract = new ethers.Contract(pairAddress, uniswapV2PairABI, provider);
        const [reserve0, reserve1] = await pairContract.getReserves();

        console.log(`Reserve0: ${reserve0.toString()}, Reserve1: ${reserve1.toString()}`);
    } catch (error) {
        console.error("Error fetching reserves:", error);
    }
};

init();
