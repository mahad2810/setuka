// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Digital Tourist ID Smart Contract
 * @dev Stores and manages digital tourist identities on blockchain
 * This is a simplified version for demonstration purposes
 */
contract DigitalTouristID {
    
    struct TouristRecord {
        string hashedKyc;       // Hashed KYC identifier (passport/aadhaar)
        uint256 startDate;      // Trip start timestamp
        uint256 endDate;        // Trip end timestamp  
        bool isActive;          // Active status
        address registeredBy;   // Who registered this ID
        uint256 registeredAt;   // When it was registered
    }
    
    // Mapping from tourist ID hash to tourist record
    mapping(string => TouristRecord) public touristRecords;
    
    // Events
    event TouristRegistered(string indexed touristIdHash, string hashedKyc, uint256 startDate, uint256 endDate);
    event TouristDeactivated(string indexed touristIdHash, address deactivatedBy);
    
    // Owner of the contract (government/authority)
    address public owner;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Register a new digital tourist ID
     * @param touristIdHash Hash of the tourist ID
     * @param hashedKyc Hash of KYC identifier
     * @param startDate Trip start timestamp
     * @param endDate Trip end timestamp
     */
    function registerTourist(
        string memory touristIdHash,
        string memory hashedKyc,
        uint256 startDate,
        uint256 endDate
    ) public onlyOwner {
        require(bytes(touristIdHash).length > 0, "Tourist ID hash cannot be empty");
        require(bytes(hashedKyc).length > 0, "KYC hash cannot be empty");
        require(startDate < endDate, "Start date must be before end date");
        require(endDate > block.timestamp, "End date must be in the future");
        require(!touristRecords[touristIdHash].isActive, "Tourist ID already exists");
        
        touristRecords[touristIdHash] = TouristRecord({
            hashedKyc: hashedKyc,
            startDate: startDate,
            endDate: endDate,
            isActive: true,
            registeredBy: msg.sender,
            registeredAt: block.timestamp
        });
        
        emit TouristRegistered(touristIdHash, hashedKyc, startDate, endDate);
    }
    
    /**
     * @dev Verify if a tourist ID is valid
     * @param touristIdHash Hash of the tourist ID to verify
     * @return isValid Whether the ID is valid
     * @return isExpired Whether the ID has expired
     * @return startDate Trip start timestamp
     * @return endDate Trip end timestamp
     */
    function verifyTourist(string memory touristIdHash) 
        public 
        view 
        returns (
            bool isValid,
            bool isExpired,
            uint256 startDate,
            uint256 endDate
        ) 
    {
        TouristRecord memory record = touristRecords[touristIdHash];
        
        isValid = record.isActive && bytes(record.hashedKyc).length > 0;
        isExpired = block.timestamp > record.endDate;
        startDate = record.startDate;
        endDate = record.endDate;
    }
    
    /**
     * @dev Deactivate a tourist ID
     * @param touristIdHash Hash of the tourist ID to deactivate
     */
    function deactivateTourist(string memory touristIdHash) public onlyOwner {
        require(touristRecords[touristIdHash].isActive, "Tourist ID is not active");
        
        touristRecords[touristIdHash].isActive = false;
        
        emit TouristDeactivated(touristIdHash, msg.sender);
    }
    
    /**
     * @dev Get tourist record details
     * @param touristIdHash Hash of the tourist ID
     * @return hashedKyc Hashed KYC identifier
     * @return startDate Trip start timestamp
     * @return endDate Trip end timestamp
     * @return isActive Active status
     * @return registeredAt Registration timestamp
     */
    function getTouristRecord(string memory touristIdHash) 
        public 
        view 
        returns (
            string memory hashedKyc,
            uint256 startDate,
            uint256 endDate,
            bool isActive,
            uint256 registeredAt
        ) 
    {
        TouristRecord memory record = touristRecords[touristIdHash];
        
        return (
            record.hashedKyc,
            record.startDate,
            record.endDate,
            record.isActive,
            record.registeredAt
        );
    }
    
    /**
     * @dev Check if a tourist ID exists
     * @param touristIdHash Hash of the tourist ID
     * @return exists Whether the tourist ID exists
     */
    function touristExists(string memory touristIdHash) public view returns (bool exists) {
        return bytes(touristRecords[touristIdHash].hashedKyc).length > 0;
    }
    
    /**
     * @dev Transfer ownership of the contract
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
}