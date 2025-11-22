// lib/checkUser.js
import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";

export const checkUser = async () => {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  try {
    // Check if user already exists in DB
    let loggedInUser = await db.user.findUnique({
      where: {
        clerkUserId: user.id,
      },
    });

    // If not, create new user
    if (!loggedInUser) {
      const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();

      loggedInUser = await db.user.create({
        data: {
          clerkUserId: user.id,
          name: name || user.username || "Unknown User",
          imageUrl: user.imageUrl,
          email: user.emailAddresses[0]?.emailAddress || "",
        },
      });
    }

    return loggedInUser;
  } catch (error) {
    console.error("❌ Error in checkUser:", error.message);
    return null;
  }
};
