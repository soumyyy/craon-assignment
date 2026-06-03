import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "craon_assignment")

client = AsyncIOMotorClient(MONGODB_URI)


def get_db() -> AsyncIOMotorDatabase:
    return client[MONGODB_DB]


def close_client() -> None:
    client.close()
