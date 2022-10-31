const { getWeth, AMOUNT } = require("../scripts/getWeth")
const { getNamedAccounts, ethers } = require("hardhat")


// aave protocol treats everythin' as an ERC20 token
//yarn hardhat run scripts/aaveBorrow.js --network hardhat

// for reading a contract, u dont need a signer (ie. u dont need to connect an account to the contract), sending neds a signer
// approve b4 borrowin' (else u'll get an error)

async function main() {
    await getWeth()
    const  { deployer } = await getNamedAccounts()
    // to interact with aave protocol, we need abi and address
    //0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5 //lendingPoolAddressProvider //https://docs.aave.com/developers/v/2.0/deployed-contracts/deployed-contracts

    const lendingPool = await getLendingPool(deployer)
    console.log(`LendingPool address ${lendingPool.address}`)

    //deposit
    // b4 depositing, we need to allow the aave contract to take money from our account 
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

    //approve
    await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer)
    console.log("Depositing...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("Deposited")

    /*** BORROW ***/
    // We need functions for: how much we've borrowed, how much we hv in collateral, how much we can borrow
    // The amount of money you can borrow < the amount of money you have deposited as collateral (Eg: Loan to value ratio of DAI is 77%)
    // Liquidation threshold is 80% for DAI (if you borrow >= 80% of what u hv deposited, u'll get liquidated)
    // If healthfactor < 1, u'll get liquidated
        
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(
        lendingPool,
        deployer
    )
    const daiPrice = await getDaiPrice()
    const amountInDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1/daiPrice.toString()) // just bein' safe by borrowin' 95% of amount that we can borrow
    console.log(`You can borrow ${amountInDaiToBorrow} DAI`)
    const amountInDaiToBorrowWei = ethers.utils.parseEther(amountInDaiToBorrow.toString()) // convertin' dai to wei

    const daiTokenAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F" //https://etherscan.io/token/0x6b175474e89094c44da98b954eedeac495271d0f
    await borrowDai(daiTokenAddress, lendingPool, amountInDaiToBorrowWei, deployer)

    await getBorrowUserData(lendingPool, deployer)
    await repay(amountInDaiToBorrowWei, daiTokenAddress, lendingPool, deployer)
    await getBorrowUserData(lendingPool, deployer) // to print the data again

}

async function repay(amount, daiAddress, lendingPool, account) { //daiAddress is the address of the underlying asset, repay on the behalf of account
    await approveErc20(daiAddress, lendingPool.address, amount, account) //we need to aprove b4 repayin'
    const repayTx = await lendingPool.repay(daiAddress, amount, 1, account) //1 is stable rateMode
    await repayTx.wait(1)
}

async function borrowDai( daiAddress, lendingPool, amountInDaiToBorrow, account) {
                                                                        // 1 means stable (interest rate mode) //0 is the referral code
    const borrowTx = await lendingPool.borrow(daiAddress, amountInDaiToBorrow, 1, 0, account)
    await borrowTx.wait(1)
    console.log("You've borrowed!")
}

async function getDaiPrice() {
    const daiPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface", //the name of the interface
        "0x773616E4d11A78F511299002da57A0a94577F1f4" //we dont need to connect it to the deployer as we r just reading and not sending any txns
    )
    const price = (await daiPriceFeed.latestRoundData())[1] //answer is at 1st index (see latestRoundData() in AggregatorV3Interface.sol)
    console.log(`The DAI/ETH price is ${price.toString()}`)
    return price
}

async function getBorrowUserData(lendingPool, account) { // the account whose data we want
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } = await lendingPool.getUserAccountData(account)
    console.log(`You have ${totalCollateralETH} worth of ETH deposited`)
    console.log(`You have ${totalDebtETH} worth of ETH borowed`)
    console.log(`You can borrow ${availableBorrowsETH} worth of ETH`)
    return { totalDebtETH, availableBorrowsETH }
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "contracts/interfaces/ILendingPoolAddressesProvider.sol:ILendingPoolAddressesProvider",
        "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
        account
    )
    //lendingPoolAddressesProvider is the contract to get the address of the lendingPool contract
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt(
        "ILendingPool",
        lendingPoolAddress,
        account
    )
    return lendingPool
}
                                            // contract we are givin' the approval to, how much amount are we approvin'
async function approveErc20(erc20Address, spenderAddress, amountToSpend, account) {
    const erc20Token = await ethers.getContractAt(
        "IERC20",
        erc20Address,
        account
    )
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log("Approved!")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })

/*
Got 20000000000000000 WETH
LendingPool address 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9
Approved!
Depositing...
Deposited
You have 20000000000000000 worth of ETH deposited
** You have 0 worth of ETH borowed
You can borrow 16500000000000000 worth of ETH
The DAI/ETH price is 628844415857566
You can borrow 24.926674396279296 DAI
You've borrowed!
You have 20000000155636750 worth of ETH deposited
** You have 15675000000000000 worth of ETH borowed
You can borrow 825000128400319 worth of ETH
Approved!
You have 20000000261752715 worth of ETH deposited
** You have 821360690 worth of ETH borowed  
You can borrow 16499999394585300 worth of ETH
Done in 52.15s.

Why is a lil amount of eth still borrowed? (even though we ran the repay function) 
answer: interest rate reasons
we can swap the remaing eth for dai (usin' uniSwap)

*/