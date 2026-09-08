import dotenv from "dotenv"
dotenv.config();

import app from "./app.js";

import { connectDatabase    } from "./config/database.js";
import { connectRedis } from "./config/redis.js";


const PORT=process.env.PORT || 5000;

const startServer = async () =>
{
    try
    {
        await connectDatabase();
        await connectRedis();

        app.listen(PORT,()=>{
            console.log(`server running on port ${PORT}`)
        })
    }
    catch(error)
    {
        console.error("failed to server start",error);
        process.exit(1);
    }
}

startServer();
