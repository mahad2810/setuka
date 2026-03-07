import { createPublicClient, http } from 'viem';
import { polygonAmoy } from 'viem/chains';

// Contract ABI with the functions we need
const TOURIST_CONTRACT_ABI = [
  {
    inputs: [
      { name: '_touristId', type: 'string' },
      { name: '_name', type: 'string' },
      { name: '_kycType', type: 'string' },
      { name: '_kycNumber', type: 'string' },
      { name: '_startDate', type: 'uint256' },
      { name: '_endDate', type: 'uint256' },
      { name: '_emergencyContactName', type: 'string' },
      { name: '_emergencyContactPhone', type: 'string' },
      { name: '_emergencyContactEmail', type: 'string' },
      { name: '_itinerary', type: 'string' }
    ],
    name: 'registerTourist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: '_touristId', type: 'string' }
    ],
    name: 'getTouristName',
    outputs: [
      { name: '', type: 'string' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: '', type: 'string' }
    ],
    name: 'tourists',
    outputs: [
      { name: 'touristId', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'kycType', type: 'string' },
      { name: 'kycNumber', type: 'string' },
      { name: 'startDate', type: 'uint256' },
      { name: 'endDate', type: 'uint256' },
      { name: 'emergencyContactName', type: 'string' },
      { name: 'emergencyContactPhone', type: 'string' },
      { name: 'emergencyContactEmail', type: 'string' },
      { name: 'itinerary', type: 'string' },
      { name: 'isActive', type: 'bool' },
      { name: 'registrationTime', type: 'uint256' },
      { name: 'registeredBy', type: 'address' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

const CONTRACT_ADDRESS = '0x94E9B4A5F04B97801AD5230f4cf74bd75916Fe29' as const;

export interface TouristData {
  touristId: string;
  name: string;
  kycType: string;
  kycNumber: string;
  startDate: string;
  endDate: string;
  emergencyContact: string;
  itinerary: string;
  registrationTime: string;
  isActive: boolean;
}

export interface BlockchainVerification {
  success: boolean;
  isValid: boolean;
  touristData?: TouristData;
  blockchainVerification?: {
    contractAddress: string;
    network: string;
    chainId: number;
  };
  error?: string;
}

class BlockchainService {
  private publicClient;

  constructor() {
    this.publicClient = createPublicClient({
      chain: polygonAmoy,
      transport: http(`https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
    });
  }

  async verifyTourist(touristId: string): Promise<BlockchainVerification> {
    try {
      console.log('🔍 Verifying tourist on blockchain:', touristId);

      // First check if tourist exists using the touristExists mapping
      let touristExists;
      try {
        touristExists = await this.publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: [
            {
              inputs: [{ name: '', type: 'string' }],
              name: 'touristExists',
              outputs: [{ name: '', type: 'bool' }],
              stateMutability: 'view',
              type: 'function'
            }
          ],
          functionName: 'touristExists',
          args: [touristId]
        });
        
        console.log('🔍 Tourist exists check:', touristExists);
      } catch (error) {
        console.log('❌ Error checking tourist existence:', error);
      }

      // Try to get the tourist data using the tourists mapping
      const touristData = await this.publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: TOURIST_CONTRACT_ABI,
        functionName: 'tourists',
        args: [touristId]
      });

      console.log('📋 Raw blockchain data:', touristData);

      // Check if tourist exists (name should not be empty)
      if (!touristData || !touristData[1] || touristData[1].length === 0) {
        // Try alternative verification using getTouristName
        try {
          console.log('🔍 Trying getTouristName as alternative...');
          const touristName = await this.publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: TOURIST_CONTRACT_ABI,
            functionName: 'getTouristName',
            args: [touristId]
          });
          
          console.log('📝 Tourist name from getTouristName:', touristName);
          
          if (!touristName || touristName.length === 0) {
            return {
              success: true,
              isValid: false,
              error: `Tourist ID not found on blockchain (exists: ${touristExists})`,
              blockchainVerification: {
                contractAddress: CONTRACT_ADDRESS,
                network: 'Polygon Amoy Testnet',
                chainId: 80002
              }
            };
          }
        } catch (nameError) {
          console.log('❌ getTouristName also failed:', nameError);
          return {
            success: true,
            isValid: false,
            error: `Tourist ID not found on blockchain (exists: ${touristExists}, error: ${nameError})`,
            blockchainVerification: {
              contractAddress: CONTRACT_ADDRESS,
              network: 'Polygon Amoy Testnet',
              chainId: 80002
            }
          };
        }
      }

      // Parse the tourist data from the contract response
      const [
        contractTouristId,
        name,
        kycType,
        kycNumber,
        startDateTimestamp,
        endDateTimestamp,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactEmail,
        itinerary,
        isActive,
        registrationTime,
        registeredBy
      ] = touristData;

      // Convert timestamps to readable dates
      const startDate = new Date(Number(startDateTimestamp) * 1000).toISOString().split('T')[0];
      const endDate = new Date(Number(endDateTimestamp) * 1000).toISOString().split('T')[0];
      const registrationTimeReadable = new Date(Number(registrationTime) * 1000).toISOString();

      const parsedTouristData: TouristData = {
        touristId: contractTouristId,
        name,
        kycType,
        kycNumber,
        startDate,
        endDate,
        emergencyContact: `${emergencyContactName} (${emergencyContactPhone}) - ${emergencyContactEmail}`,
        itinerary,
        registrationTime: registrationTimeReadable,
        isActive
      };

      console.log('✅ Successfully verified tourist:', parsedTouristData.name);

      return {
        success: true,
        isValid: isActive,
        touristData: parsedTouristData,
        blockchainVerification: {
          contractAddress: CONTRACT_ADDRESS,
          network: 'Polygon Amoy Testnet',
          chainId: 80002
        }
      };

    } catch (error) {
      console.error('❌ Blockchain verification error:', error);
      return {
        success: false,
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown blockchain error',
        blockchainVerification: {
          contractAddress: CONTRACT_ADDRESS,
          network: 'Polygon Amoy Testnet',
          chainId: 80002
        }
      };
    }
  }

  async registerTourist(touristData: any): Promise<{ success: boolean; error?: string }> {
    try {
      // For now, return success as registration is handled by the blockchain-register endpoint
      console.log('⚠️ Registration should use the blockchain-register API endpoint');
      return { success: false, error: 'Use blockchain-register API endpoint for registration' };
    } catch (error) {
      console.error('❌ Registration error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown registration error' 
      };
    }
  }

  async deactivateTourist(touristId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // For now, just return success as deactivation would require wallet integration
      console.log('⚠️ Deactivation not implemented in read-only mode');
      return { success: false, error: 'Deactivation requires wallet integration' };
    } catch (error) {
      console.error('❌ Deactivation error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown deactivation error' 
      };
    }
  }
}

// Export a singleton instance
export const blockchainService = new BlockchainService();