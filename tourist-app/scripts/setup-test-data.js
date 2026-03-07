// Test users for development
// Run this in MongoDB to create test data

db.users.insertMany([
  {
    name: "Test User",
    email: "test@setuka.com",
    password: "$2a$10$rOeJ7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7", // password: "password123"
    phone: "+1 (555) 123-4567",
    nationality: "American",
    passportNumber: "A12345678",
    digitalId: "DID-TEST123456",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: "Demo Tourist",
    email: "demo@setuka.com", 
    password: "$2a$10$rOeJ7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7J7", // password: "demo123"
    phone: "+44 7700 900123",
    nationality: "British",
    passportNumber: "B98765432",
    digitalId: "DID-DEMO789012",
    createdAt: new Date(),
    updatedAt: new Date()
  }
])

// Create indexes for better performance
db.users.createIndex({ "email": 1 }, { unique: true })
db.users.createIndex({ "digitalId": 1 }, { unique: true })
