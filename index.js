const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const app = express();
const cors = require("cors");
var jwt = require("jsonwebtoken");
require("dotenv").config();

const port = process.env.PORT || 5000;

////////  MIDDLEWARES  ////////////
app.use(cors());
app.use(express.json());

//////////////////////////////////

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e9we0w0.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    ///////////////////////////////////////

    ///////////////////////////////////
    ///////////   DATABASE   //////////
    ///////////////////////////////////
    const propertyCollection = client
      .db("primePropertyPulse")
      .collection("properties");

    const reviewCollection = client
      .db("primePropertyPulse")
      .collection("reviews");

    const userCollection = client.db("primePropertyPulse").collection("users");

    ///////////////////////////////////
    ///////////     API     //////////
    ///////////////////////////////////

    ///////////     JWT     //////////

    // create jwt token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });
      res.send({ token });
    });

    ///////////   MY  MIDDLEWARE     //////////

    // token verify middleware
    const verifyToken = (req, res, next) => {
      const tokenWithBearer = req.headers.Authorization;
      console.log("inside verifyToken middleware //////=>", tokenWithBearer);
      if (!tokenWithBearer) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = tokenWithBearer.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decodedToken = decoded;
        next();
      });
    };

    ///////////     USERS     //////////

    // create user
    app.post("/users", async (req, res) => {
      // get user email form client side
      const user = req.body;
      // create user email query
      const query = { email: user.email };
      // get user from DB
      const isUserExist = await userCollection.findOne(query);
      // if user already exist in DB, then return with insertedId: null
      if (isUserExist) {
        return res.send({
          message: "user already exists in P P P",
          insertedId: null,
        });
      }
      // if user don't exist in DB, then insert user in DB
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    ///////////     PROPERTY     //////////

    // public get
    app.get("/properties/verified", async (req, res) => {
      const query = { propertyVerificationStatus: "verified" };
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/property/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(query);
      res.send(result);
    });
    ///////////     REVIEWS     //////////
    // public get
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    ///////////////////////////////////////
    // Send a ping to confirm a successful connection
    /*  await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    ); */
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

//////////////////////////////////
app.get("/", (req, res) => {
  res.send("Prime Property Pulse is Running");
});

app.listen(port, () => {
  console.log(`PRIME PROPERTY PULSE IS RUNNING ON PORT ${port}`);
});
