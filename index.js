require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const port = process.env.PORT || 3000;


const admin = require("firebase-admin");
const serviceAccount = require("./jatri-9cc51-firebase-adminsdk-service-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const app = express();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.1k8uoge.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});





const verifyFirebaseToken = async(req,res,next) => {
  const authHeader = req.headers?.authorization;
  // console.log(authHeader);

  if(!authHeader || !authHeader.startsWith("Bearer ")){
    return res.status(401).send({message: "Unauthorized Access Found!"})
  }

  const token = authHeader.split(' ')[1];
  try{
    const decoded = await admin.auth().verifyIdToken(token);
    // console.log('Decoded token' , decoded);
    req.decoded = decoded;
    next();
  }
  catch(error){
    return res.status(401).send({message: "Unauthorized Access Found!"})

  }

}

async function run() {
  try {
    
    // carCollection
    const carCollection = client.db("Jatri").collection("cars");
    const bookCollection = client.db("Jatri").collection("bookings");

    // for creating new car data
    app.post('/cars' , verifyFirebaseToken , async(req,res)=>{
      const addCarData = req.body;
      const result = await carCollection.insertOne(addCarData);
      res.send(result);
    }) 

    //  for showing car 
    app.get("/cars" , async(req,res)=>{
      const { sort } = req.query;
    const { searchText } = req.query;

    // console.log("Received searchText:", searchText);

    let query = {};
    let sortBy = {};

    if (sort === "Oldest") {
      sortBy = { date: 1 };
    } else if (sort === "Newest") {
      sortBy = { date: -1 };
    } else if (sort === "Lowest") {
      sortBy = { rental_price: 1 };
    } else if (sort === "Highest") {
      sortBy = { rental_price: -1 };
    }

    if (searchText) {
        query = {
          $or: [
            { car_location: { $regex: searchText, $options: "i" } },
            { car_model: { $regex: searchText, $options: "i" } }
          ]
        }
    }
    const result = await carCollection.find(query).sort(sortBy).toArray();
    
    res.send(result);
    })


    //  for showing 6-8 data
    app.get("/cars/filteredData" , async(req,res)=>{
      const carData = await carCollection.find().sort({date: -1}).limit(6).toArray();
      // console.log(carData)
      res.send(carData);
    })

    
    // for showing individual cars per user
    app.get('/cars/email' , async (req, res) => {
    const { email, sort } = req.query;
    const query = email ? { email } : {};


    // console.log("req headers:", req.headers);

    let sortBy = {};

    if (sort === "Oldest") {
      sortBy = { date: 1 };
    } else if (sort === "Newest") {
      sortBy = { date: -1 };
    } else if (sort === "Lowest") {
      sortBy = { rental_price: 1 };
    } else if (sort === "Highest") {
      sortBy = { rental_price: -1 };
    }

    const result = await carCollection.find(query).sort(sortBy).toArray();
    res.send(result);
  });

    // for showing cars details
    app.get('/cars/:id' , async(req,res)=>{
      const id = req.params.id;
      const query = { _id : new ObjectId(id) };


      const result = await carCollection.findOne(query);
      res.send(result);
    })

     // for updating car info
    app.put('/cars/:id' , async(req,res)=>{
      const id = req.params.id;
      const filter = { _id : new ObjectId(id) };

      const options = { upsert: true };
      const updatedCar = req.body;
      const updatedDoc = {
        $set: updatedCar
      }

      const result = await carCollection.updateOne(filter,updatedDoc,options);
      res.send(result);
    }) 

    // for deleting cars
    app.delete("/cars/:id" , async(req,res)=>{
      const id = req.params.id;
      const query = { _id:new ObjectId(id)};

      const result = await carCollection.deleteOne(query);
      res.send(result);
    })

    // for handling booking count
    app.patch("/cars/bookings/:id" , async(req,res)=>{
      const id = req.params.id;
      const filter = { _id : new ObjectId(id)}

      const incrementing = { $inc : {car_booking_count: 1} };

      const result = await carCollection.updateOne(filter,incrementing);
      res.send(result)
    })
    



    // for showing all the bookings
    app.get('/bookings' , async(req,res)=>{
      const result = await bookCollection.find().toArray();
      res.send(result);
    })

    // for creating a new booking
    app.post('/bookings' , async(req,res)=>{
      const addACar = req.body;
      const result = await bookCollection.insertOne(addACar);
      res.send(result);
    })

    // for showing individual booking per user
    app.get('/bookings/email' , verifyFirebaseToken , async(req,res)=>{
      const email = req.query.email;

      if(email !== req.decoded.email){
        return res.status(403).send({message : "Forbidden Access Found!"})
      }

      const query = {}

      // console.log(email,query)
      if(email){
        query.userEmail = email;
      }

      const result = await bookCollection.find(query).toArray();
      // console.log(email,result)
      res.send(result);
    })

    // for handling confirm or cancel car booking
    app.patch('/bookings/:id' ,async(req,res)=>{
      const id = req.params.id;
      const filter = { _id: new ObjectId(id)};

      const updatedDoc = {
        $set: {
          bookingStart : req.body.bookingStart,
          bookingEnd : req.body.bookingEnd,
          bookingStatus : req.body.bookingStatus,
          totalPrice : req.body.totalPrice
        }
      }

      const result = await bookCollection.updateOne(filter,updatedDoc);
      res.send(result)
    })


    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } 
  finally {}
}
run().catch(console.dir);



app.get('/' , (req,res)=>{
    res.send("Jatri server is running");
})

app.listen(port, ()=>{
    console.log(`Jatri server is running on port,${port}`);
})
