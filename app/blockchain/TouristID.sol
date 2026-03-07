// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TouristID {
    struct Tourist {
        string touristId;
        string name;
        string kycType;
        string kycNumber;
        uint256 startDate;
        uint256 endDate;
        string emergencyContactName;
        string emergencyContactPhone;
        string emergencyContactEmail;
        string itinerary;
        bool isActive;
        uint256 registrationTime;
        address registeredBy;
    }
    
    mapping(string => Tourist) public tourists;
    mapping(string => bool) public touristExists;
    string[] public allTouristIds;
    
    uint256 public totalTourists;
    
    event TouristRegistered(
        string indexed touristId,
        string name,
        address indexed registeredBy,
        uint256 registrationTime
    );
    
    event TouristDeactivated(
        string indexed touristId,
        address indexed deactivatedBy
    );
    
    modifier touristMustExist(string memory _touristId) {
        require(touristExists[_touristId], "Tourist ID does not exist");
        _;
    }
    
    function registerTourist(
        string memory _touristId,
        string memory _name,
        string memory _kycType,
        string memory _kycNumber,
        uint256 _startDate,
        uint256 _endDate,
        string memory _emergencyContactName,
        string memory _emergencyContactPhone,
        string memory _emergencyContactEmail,
        string memory _itinerary
    ) public {
        require(!touristExists[_touristId], "Tourist ID already exists");
        require(_endDate > _startDate, "End date must be after start date");
        require(bytes(_touristId).length > 0, "Tourist ID cannot be empty");
        require(bytes(_name).length > 0, "Name cannot be empty");
        
        tourists[_touristId] = Tourist({
            touristId: _touristId,
            name: _name,
            kycType: _kycType,
            kycNumber: _kycNumber,
            startDate: _startDate,
            endDate: _endDate,
            emergencyContactName: _emergencyContactName,
            emergencyContactPhone: _emergencyContactPhone,
            emergencyContactEmail: _emergencyContactEmail,
            itinerary: _itinerary,
            isActive: true,
            registrationTime: block.timestamp,
            registeredBy: msg.sender
        });
        
        touristExists[_touristId] = true;
        allTouristIds.push(_touristId);
        totalTourists++;
        
        emit TouristRegistered(_touristId, _name, msg.sender, block.timestamp);
    }
    
    // Simplified functions with fewer return parameters
    function getTouristName(string memory _touristId) 
        public 
        view 
        touristMustExist(_touristId) 
        returns (string memory) 
    {
        return tourists[_touristId].name;
    }
    
    function getTouristKYC(string memory _touristId) 
        public 
        view 
        touristMustExist(_touristId) 
        returns (string memory kycType, string memory kycNumber) 
    {
        Tourist storage tourist = tourists[_touristId];
        return (tourist.kycType, tourist.kycNumber);
    }
    
    function getTouristDates(string memory _touristId) 
        public 
        view 
        touristMustExist(_touristId) 
        returns (uint256 startDate, uint256 endDate) 
    {
        Tourist storage tourist = tourists[_touristId];
        return (tourist.startDate, tourist.endDate);
    }
    
    function getTouristPhone(string memory _touristId) 
        public 
        view 
        touristMustExist(_touristId) 
        returns (string memory) 
    {
        return tourists[_touristId].emergencyContactPhone;
    }
    
    function getTouristEmail(string memory _touristId) 
        public 
        view 
        touristMustExist(_touristId) 
        returns (string memory) 
    {
        return tourists[_touristId].emergencyContactEmail;
    }
    
    function getTouristItinerary(string memory _touristId) 
        public 
        view 
        touristMustExist(_touristId) 
        returns (string memory) 
    {
        return tourists[_touristId].itinerary;
    }
    
    function isValidTourist(string memory _touristId) 
        public 
        view 
        returns (bool) 
    {
        if (!touristExists[_touristId]) return false;
        
        Tourist storage tourist = tourists[_touristId];
        return tourist.isActive && 
               block.timestamp >= tourist.startDate && 
               block.timestamp <= tourist.endDate;
    }
    
    function deactivateTourist(string memory _touristId) 
        public 
        touristMustExist(_touristId) 
    {
        require(
            tourists[_touristId].registeredBy == msg.sender,
            "Only the registrar can deactivate this tourist ID"
        );
        
        tourists[_touristId].isActive = false;
        emit TouristDeactivated(_touristId, msg.sender);
    }
    
    function getAllTouristIds() public view returns (string[] memory) {
        return allTouristIds;
    }
    
    function getTotalTourists() public view returns (uint256) {
        return totalTourists;
    }
}