export const defaultPlans = [
    {
        name: "BASIC",
        description: "Basic plan with essential features",
        price: {
            amount: 0,
            currency: "usd"
        },
        features: {
            voicesPerMonth: 25,
            meetingsPerMonth: 8
        },
        isActive: true
    },
    {
        name: "STANDARD",
        description: "Professional plan with enhanced features",
        price: {
            amount: 49,
            currency: "usd"
        },
        features: {
            voicesPerMonth: 60,
            meetingsPerMonth: 1
        },
        isActive: true
    },
    {
        name: "PRO",
        description: "Advanced plan with premium features",
        price: {
            amount: 99,
            currency: "usd"
        },
        features: {
            voicesPerMonth: -1, // -1 indicates unlimited
            meetingsPerMonth: 3
        },
        isActive: true
     }
]; 