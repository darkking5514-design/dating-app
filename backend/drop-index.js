import mongoose from 'mongoose';
import 'dotenv/config';

async function dropIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Drop indexes from friends collection
    const friendsCollection = mongoose.connection.collection('friends');
    const friendsIndexes = await friendsCollection.indexes();
    console.log('Friends indexes:', friendsIndexes);
    
    for (const index of friendsIndexes) {
      if (index.name !== '_id_') {
        await friendsCollection.dropIndex(index.name);
        console.log(`Dropped index: ${index.name} from friends`);
      }
    }
    
    // Drop indexes from friendrequests collection
    const friendRequestsCollection = mongoose.connection.collection('friendrequests');
    const friendRequestsIndexes = await friendRequestsCollection.indexes();
    console.log('FriendRequests indexes:', friendRequestsIndexes);
    
    for (const index of friendRequestsIndexes) {
      if (index.name !== '_id_') {
        await friendRequestsCollection.dropIndex(index.name);
        console.log(`Dropped index: ${index.name} from friendrequests`);
      }
    }
    
    // Delete all existing data
    await friendsCollection.deleteMany({});
    await friendRequestsCollection.deleteMany({});
    console.log('Cleared all friend and friend request data');
    
    console.log('✅ All done! Now restart your backend.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

dropIndexes();