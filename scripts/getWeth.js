const { getNamedAccounts, ethers } = require("hardhat")

const AMOUNT = ethers.utils.parseEther("0.02")

async function getWeth() {
    const {deployer} = await getNamedAccounts() //we need an account to interact with a contract

    // to call weth function on deployed contract, we need abi & contract address of weth contract
    // to get the abi, we can either import the whole contract or import only the interface
    //here, IWeth.sol is taken from github repo
    //0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 // this the mainnet address (for reasons that'll be explained sson)

    const iWeth = await ethers.getContractAt(
        "IWeth", // get contract with abi of IWeth contract
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", //at this address
        deployer //and connect to this deployer's account
    )
    const tx = await iWeth.deposit({value: AMOUNT})
    await tx.wait(1) //wait 1 block confirmation
    const wethBalance = await iWeth.balanceOf(deployer)
    console.log(`Got ${wethBalance.toString()} WETH`) //Got 20000000000000000 WETH
}

module.exports = {getWeth, AMOUNT}


/**
 * Mainnet forking: 
 * Doesn't copy the whole mainchain to our local computer (only the contract mentioned through the address)
 * Changes in this local change won't affect the real chain
 * */