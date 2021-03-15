const SHA256 = require("crypto-js/sha256");

class Block{
	
	constructor(index,timestamp,data,prevoiousHash=''){

		this.index=index;
		this.timestamp=timestamp;
		this.data=data;
		this.prevoiousHash=prevoiousHash;
		this.hash=this.calculation();
		this.nonce=0;

	}
	calculation(){

		//using SHA256
		return SHA256(this.index+this.timestamp+this.prevoiousHash+JSON.stringify(this.data)+this.nonce).toString();
	}

	mineNewBlock(difficulty){

		while(this.hash.substring(0,difficulty) !== Array(difficulty + 1).join("0")){
			this.nonce++;
			this.hash =  this.calculation();
		
		}
		
		console.log("A new block mined with hash " + this.hash);
	
	}
}

	class BlockChain{
		constructor(){

			//genesis block in array
			this.chain=[this.createGenesisBlock];

			this.difficulty = 3;

		}

		// The very first block in the blockchian
		// which is called Genesis block
		createGenesisBlock(){

			return new Block(0,"14/03/2021","This is the genesis block","0");
		}
		//this function is the very last block 
		// which is called latest block
		getLatestblock(){
		
			return this.chain[this.chain.length-1]
		}

		// to add new block in the previous block
		addBlock(newBlock){

			newBlock.prevoiousHash=this.getLatestblock().hash;
			
			newBlock.mineNewBlock(this.difficulty)
			
			this.chain.push(newBlock);
		}
		checkBlockValid(){
			 for(let i = 1; i < this.chain.length;i++){
			 	const currentBlock = this.chain[i];
			 	const previousBlock = this.chain[i-1];

			 	if(currentBlock.hash !== currentBlock.calculation()){
			 		return false;
			 	}
			 	if(currentBlock.prevoiousHash !== previousBlock.hash){
			 		return false;
			 	}
			 }
			 return true;
		}

	}

	// creating object for the blocks

	let block1 = new Block(1,"15/03.2021",{mybalance : 100});
	
	let block2 = new Block(2,"16/03.2021",{mybalance : 50});

	let myBlockchain = new BlockChain();
	
	myBlockchain.addBlock(block1);
	
	myBlockchain.addBlock(block2);

	console.log(JSON.stringify(myBlockchain,null,4));

	console.log("Validation check for the block chain " + myBlockchain.checkBlockValid());