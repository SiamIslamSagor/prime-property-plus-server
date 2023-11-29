const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
var jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

    const wishListCollection = client
      .db("primePropertyPulse")
      .collection("wishList");

    const propertyBoughtCollection = client
      .db("primePropertyPulse")
      .collection("propertyBought");

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
      const tokenWithBearer = req?.headers?.authorization;
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
        console.log("decoded email:", decoded.email);
        next();
      });
    };

    // admin verify middleware
    const verifyAdmin = async (req, res, next) => {
      // get decoded email
      const email = req.decodedToken?.email;
      // create query
      const query = { email: email };
      // find user by there query
      const user = await userCollection.findOne(query);
      // get user role
      const isAdmin = user?.role === "admin";
      // if user role not admin, then return
      console.log(" HIT: verify admin middleware");

      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      console.log("admin verified");
      // if all ok, then next()
      next();
    };

    // admin verify middleware
    const verifyAgent = async (req, res, next) => {
      // get decoded email
      const email = req.decodedToken?.email;
      // create query
      const query = { email: email };
      // find user by there query
      const user = await userCollection.findOne(query);
      // get user role
      const isAgent = user?.role === "agent";
      // if user role not agent, then return
      console.log(" HIT: verify agent middleware");

      if (!isAgent) {
        return res.status(403).send({ message: "forbidden access" });
      }
      console.log("agent verified");
      // if all ok, then next()
      next();
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

    // get all user
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // is admin checker
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      console.log(" HIT: /users/admin/:email");
      const email = req?.params?.email;
      if (email !== req?.decodedToken?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // is agent checker
    app.get("/users/agent/:email", verifyToken, async (req, res) => {
      console.log(" HIT: /users/agent/:email");
      const email = req?.params?.email;
      if (email !== req?.decodedToken?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let agent = false;
      if (user) {
        agent = user?.role === "agent";
      }
      res.send({ agent });
    });

    ///////////     PROPERTY     //////////

    // public get
    app.get("/properties/verified", async (req, res) => {
      const query = { propertyVerificationStatus: "verified" };
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/properties/all", verifyToken, verifyAdmin, async (req, res) => {
      const result = await propertyCollection.find().toArray();
      res.send(result);
    });

    app.get("/properties/advertiseProperty", async (req, res) => {
      const query = { isAdvertiseProperty: true };
      const result = await propertyCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/property/details/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.findOne(query);
      res.send(result);
    });

    app.patch("/properties/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body?.status;
      console.log("patch:", status);
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedProperty = {
        $set: {
          propertyVerificationStatus: status,
        },
      };
      const result = await propertyCollection.updateOne(
        filter,
        updatedProperty,
        options
      );
      res.send(result);
    });

    app.get(
      "/properties/agent/:email",
      verifyToken,
      verifyAgent,
      async (req, res) => {
        const email = req.params.email;
        if (email !== req?.decodedToken?.email) {
          return res.status(403).send({ message: "forbidden access" });
        }
        const query = { agentEmail: email };
        const result = await propertyCollection.find(query).toArray();
        res.send(result);
      }
    );

    ///////////     wish LIST     //////////

    // add to wish list
    app.post("/wish-list", verifyToken, async (req, res) => {
      const info = req.body;
      console.log("wish List info:::>", info);
      const query = { propertyId: info?.propertyId };
      console.log("checking query for wish List:::>", query);
      const isExistInfo = await wishListCollection.findOne(query);
      if (isExistInfo) {
        return res.send({
          message: "this property you have already added in you wish list.",
        });
      }
      const result = await wishListCollection.insertOne(info);
      res.send(result);
    });

    // get wish list item by user email
    app.get("/wish-list/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req?.decodedToken?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { requesterEmail: email };
      console.log(query);
      const result = await wishListCollection.find(query).toArray();
      res.send(result);
    });

    // get single wish list item by wishList _id
    app.get("/wish-list-item/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(query);
      const result = await wishListCollection.findOne(query);
      res.send(result);
    });

    app.delete("/wish-list-item/delete/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log(query);
      const result = await wishListCollection.deleteOne(query);
      res.send(result);
    });

    ///////////     PROPERTY BOUGHT     //////////
    app.post("/property-bought", verifyToken, async (req, res) => {
      const boughtPropertyInfo = req.body;
      console.log(boughtPropertyInfo);
      const result = await propertyBoughtCollection.insertOne(
        boughtPropertyInfo
      );
      res.send(result);
    });

    app.get("/property-bought/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req?.decodedToken?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { buyerEmail: email };
      const result = await propertyBoughtCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/bought-property/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await propertyBoughtCollection.findOne(query);
      res.send(result);
    });

    app.patch("/property/bought/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      console.log(updatedData, id);
      const updatedBoughtProperty = {
        $set: {
          paymentDate: updatedData?.paymentDate,
          propertyVerificationStatus: updatedData?.propertyVerificationStatus,
          transactionId: updatedData?.transactionId,
        },
      };
      const result = await propertyBoughtCollection.updateOne(
        filter,
        updatedBoughtProperty,
        options
      );
      res.send(result);
    });

    ///////////     PAYMENT     //////////

    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      // get price
      const { price } = req.body;
      // calculate price in coin
      const amount = parseInt(price * 100);

      // create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      // send response with client secret
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    ///////////     REVIEWS     //////////

    app.post("/reviews/add", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await reviewCollection.insertOne(data);
      res.send(result);
    });

    // public get
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // get single review by user email
    app.get("/reviews/:email", verifyToken, async (req, res) => {
      console.log("trigged single review");
      const email = req.params.email;
      if (email !== req?.decodedToken?.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { reviewerEmail: email };
      const result = await reviewCollection.find(query).toArray();
      res.send(result);
    });

    // delete single review by user email
    app.delete("/reviews/delete/:id", verifyToken, async (req, res) => {
      console.log("trigged single delete review api");
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewCollection.deleteOne(query);
      res.send(result);
    });

    // get single review by there id
    app.get(
      "/single-property-reviews/:reviewedPropertyId",
      async (req, res) => {
        const reviewedPropertyId = req.params.reviewedPropertyId;
        console.log(reviewedPropertyId);
        const query = {
          reviewedPropertyId,
        };
        console.log("HIT:", "/single-property-reviews/");
        const result = await reviewCollection.find(query).toArray();
        res.send(result);
      }
    );

    ///////////////////////////////////////
    // TODO : comment this code block
    // Send a ping to confirm a successful connection
    /* await client.db("admin").command({ ping: 1 });
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
