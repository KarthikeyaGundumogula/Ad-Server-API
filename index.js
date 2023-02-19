const express = require("express");
const app = express();
const axios = require("axios");
require("dotenv").config();
const { ethers } = require("ethers");
const { query } = require("express");
const SUBGRAPH = process.env.SubGraph_URL;
const ServerAddress = process.env.Server_ADDRESS;
const Server_ABI = process.env.Server_ABI;

app.get("/:address", async (req, res) => {
  let AdId;
  let ImgLink;
  let AdLink;
  let Advertiser;
  let requiredFunds;
  let address = req.params.address;
  console.log(address);
  let query = `{
  publishers(
    where: {Publisher: "${address}"}
  ) {
    Advertisers
    ClickReward
    ViewReward
  }
}`;
  try {
    const response = await axios.post(SUBGRAPH, { query });
    const publishers = response.data?.data?.publishers;
    if (!publishers || publishers.length === 0) {
      throw new Error("No publishers found for this address");
    }
    const length = publishers[0].Advertisers.length;
    let x = Math.floor(Math.random() * length);
    AdId = x + 1;
    requiredFunds = publishers[0].ClickReward + publishers[0].ViewReward;
  } catch (error) {
    console.log("Error retrieving publishers", error);
  }
  query = `{ads(first: 5 where:{AdId:"${AdId}",CurrentFunds_gte:"${requiredFunds}" }) {
    AdData
    Advertiser
  }}`;
  try {
    const response = await axios.post(SUBGRAPH, { query });
    const ads = response.data?.data?.ads;
    if (!ads || ads.length === 0) {
      throw new Error("No ads found for this address");
    }
    AdLink = ads[0].AdData;
    Advertiser = ads[0].Advertiser;
    await axios.get(AdLink).then((res) => {
      ImgLink = res.data.ImgLink.slice(8, 81);
      fileName = res.data.ImgLink.slice(82, -4);
      console.log(ImgLink);
    });
  } catch (error) {
    res.send("No ads found for this address");
    return;
  }
  const obj = {
    ImgSrc:
      "/Img/" +
      req.params.address +
      "/" +
      Advertiser +
      "/" +
      AdId +
      "/" +
      ImgLink +
      "/" +
      fileName,
    ImmpressionLink: "/clicks/" + req.params.address + "/" + AdId,
  };
  res.send(JSON.stringify(obj));
  res.end();
});
app.get(
  "/Img/:Publisher/:Advertiser/:AdId/:ImgLink/:filename",
  async (req, res) => {
    let address = req.params.Publisher;
    let Advertiser = req.params.Advertiser;
    let AdId = req.params.AdId;
    let ImgLink = req.params.ImgLink;
    let fileName = req.params.filename;
    console.log(req.url);
    const provider = new ethers.providers.JsonRpcProvider(
      "https://polygon-mumbai.g.alchemy.com/v2/oF0VkR1DtxMYpSbUf4RyDwLyclveHuCw",
      {
        chainId: 80001,
      }
    );
    const signer = new ethers.Wallet(
      "b44242c0805f9bcb4cea019517d45ec806fb4850a15e3b28cdfc6ac261e1cbc5",
      provider
    );
    try {
      const contract = new ethers.Contract(ServerAddress, Server_ABI, signer);
      const tx = await contract.serveAd(AdId, address, Advertiser);
      tx.wait().then((receipt) => {
        console.log("done");
        res.redirect("https://" + ImgLink + "/" + fileName + ".png");
      });
    } catch (error) {
      console.log("atcontract creation", error);
    }
  }
);
app.get("/clicks/:address/:AdId", async (req, res) => {
  let address = req.params.address;
  let AdId = req.params.AdId;
  const provider = new ethers.providers.JsonRpcProvider(
    "https://polygon-mumbai.g.alchemy.com/v2/oF0VkR1DtxMYpSbUf4RyDwLyclveHuCw",
    {
      chainId: 80001,
    }
  );
  const signer = new ethers.Wallet(
    "b44242c0805f9bcb4cea019517d45ec806fb4850a15e3b28cdfc6ac261e1cbc5",
    provider
  );
  try {
    const contract = new ethers.Contract(ServerAddress, Server_ABI, signer);
    const tx = await contract.transferClickReward(AdId, address);
    tx.wait().then(async (receipt) => {
      console.log("done");
      let query = `{
    ads(first: 5 where:{AdId:"${AdId}"}) {
    AdData
  }}`;
      try {
        const response = await axios.post(SUBGRAPH, { query });
        const ads = response.data?.data?.ads;
        if (!ads || ads.length === 0) {
          throw new Error("No ads found for this address");
        }
        AdLink = ads[0].AdData;
        console.log(AdLink);
        res.redirect(AdLink);
      } catch (error) {
        res.send("No ads found for this address");
        return;
      }
    });
  } catch (error) {
    res.send("error occured try again");
    console.log("atcontract creation", error);
  }
});

app.listen(3030, () => {
  console.log("Server is running on port 3000");
});
