const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };


// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());
app.use(express.json()); // Add this line to parse JSON request bodies

// MongoDB connection parameters
const uri = "mongodb+srv://user:user123@banking.vtjlomh.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

async function startServer() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    // Define the /customers route
    app.get('/customers', async (req, res) => {
      try {
        const collection = client.db("banking_system").collection("bankdetails");
        const results = await collection.find().toArray();
        res.json(results);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Define the /transactions route
    app.get('/transactions', async (req, res) => {
      try {
        const collection = client.db("banking_system").collection("transactionhistory");
        const results = await collection.find().toArray();
        res.json(results);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    // Define the /transfer route
    app.post('/transfer', async (req, res) => {
      const { sourceId, destinationId, amount } = req.body;
    
      try {
        const session = client.startSession();
    
        session.startTransaction();
    
        const collection = client.db("banking_system").collection("bankdetails");
        const transactionCollection = client.db("banking_system").collection("transactionhistory");
    
        const sourceCustomer = await collection.findOne({ id: sourceId }, { session });
        const destinationCustomer = await collection.findOne({ id: destinationId }, { session });
    
        if (!sourceCustomer || !destinationCustomer) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ error: 'Destination customer not found.' });
          return;
        }
    
        if (sourceCustomer.balance < amount) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({ error: 'Insufficient balance in the source account.' });
          return;
        }
    
        // Deduct the transfer amount from the source account and add it to the destination account
        sourceCustomer.balance -= amount;
        destinationCustomer.balance += amount;
    
        // Update the customer balances in the database
        await collection.updateOne({ id: sourceId }, { $set: { balance: sourceCustomer.balance } }, { session });
        await collection.updateOne({ id: destinationId }, { $set: { balance: destinationCustomer.balance } }, { session });
    
        // Insert the transaction history
        await transactionCollection.insertOne({
          id:sourceCustomer.id,
          sender: sourceCustomer.name,
          receiver: destinationCustomer.name,
          amount: amount,
          time: new Date().toLocaleString('en-US', options)
        }, { session });
    
        await session.commitTransaction();
        session.endSession();
    
        res.status(200).json({ message: 'Money transfer successful.' });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
    

    // Start the server
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  }
}

startServer();
