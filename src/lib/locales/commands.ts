

export type CommandGroup = {
  display: string;
  // Reply can be a single string or an array of possible replies.
  reply: string | string[];
};

// Rewritten replies to be more conversational and varied.
export const generalCommands: Record<string, CommandGroup> = {
    'home': { 
        display: 'Go Home', 
        reply: ['Going to the home page.', 'Okay, heading home.', 'Right away!'] 
    },
    'stores': { 
        display: 'Browse Stores', 
        reply: ['Here are all the nearby stores.', 'Showing all available stores for you.', 'Let\'s find you a great local store.'] 
    },
    'dashboard': { 
        display: 'Go To Dashboard', 
        reply: ['Opening your dashboard now.', 'Here is your dashboard.'] 
    },
    'cart': { 
        display: 'Show Cart', 
        reply: ['Here\'s what\'s in your cart.', 'Opening your shopping cart.'] 
    },
    'orders': { 
        display: 'My Orders', 
        reply: ['Here are your past orders.', 'Opening your order history.'] 
    },
    'deliveries': { 
        display: 'My Deliveries', 
        reply: ['Opening the delivery partner dashboard.', 'Here are your delivery jobs.'] 
    },
    'myStore': { 
        display: 'My Store', 
        reply: ['Opening your store management page.', 'Let\'s take a look at your store.'] 
    },
    'myProfile': { 
        display: 'My Profile', 
        reply: ['Here is your profile information.', 'Opening your profile for you to edit.'] 
    },
    'checkout': { 
        display: 'Proceed to Checkout', 
        reply: 'Okay, let\'s complete your order.' // This one is better as a single, clear action.
    },
    'placeOrder': { 
        display: 'Place Order', 
        reply: ['Placing your order now. Thank you!', 'Order placed! We\'ll notify you with updates.'] 
    },
    'saveChanges': { 
        display: 'Save Changes', 
        reply: ['Got it. Saving your changes.', 'Okay, everything is saved.'] 
    },
    'recordOrder': { 
        display: 'Record a Voice Order', 
        reply: 'I\'m ready. Please list the items you want to order.' 
    },
    'checkPrice': { 
        display: 'Check Price', 
        reply: 'Sure, which item\'s price do you want to check?' 
    },
    'refresh': { 
        display: 'Refresh Page', 
        reply: ['Refreshing the page now.', 'Okay, let\'s get a fresh look.'] 
    },
    'acceptDeliveryJob': { 
        display: 'Accept Delivery Job', 
        reply: 'Accepting the first available job.' 
    },
    'showDetails': {
        display: 'Show Details',
        reply: 'Showing details for the first item.'
    },
    'homeAddress': { 
        display: 'Use Home Address', 
        reply: 'Setting delivery to your home address.' 
    },
    'currentLocation': { 
        display: 'Use Current Location', 
        reply: 'Using your current location for delivery.' 
    },
    'installApp': {
        display: 'Install App',
        reply: ['Opening the app installation page.', 'Here is the QR code to install the app.']
    },
    'help': { 
        display: 'Help / Commands', 
        reply: [
            'You can say things like "order 1 kilo of onions", "go to my cart", "check price of tomatoes", or "find stores near me". What would you like to do?',
            'I can help you shop. Try saying "buy two packets of milk" or "show me my orders".'
        ]
    },
    'who-are-you': { 
        display: 'Who Are You?', 
        reply: [
            'I am the LocalBasket voice assistant, here to make your grocery shopping faster and easier. Now we are using AI.',
            'I\'m your personal shopping assistant for LocalBasket.',
            'Yes, this is Shan. How can I help you today?'
        ]
    },
    'how-it-works': { 
        display: 'How It Works', 
        reply: 'Just tell me what you want to order, which store you want it from, and where to deliver it. I will handle the rest!' 
    }
};

    
