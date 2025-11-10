
export type CommandGroup = {
  display: string;
  reply: string;
};

export const generalCommands: Record<string, CommandGroup> = {
    'home': { display: 'Go Home', reply: 'Navigating to home page.' },
    'stores': { display: 'Browse Stores', reply: 'Showing all available stores.' },
    'dashboard': { display: 'Go To Dashboard', reply: 'Opening your dashboard.' },
    'cart': { display: 'Show Cart', reply: 'Opening your shopping cart.' },
    'orders': { display: 'My Orders', reply: 'Here are your past orders.' },
    'deliveries': { display: 'My Deliveries', reply: 'Opening the delivery partner dashboard.' },
    'myStore': { display: 'My Store', reply: 'Opening your store management page.' },
    'myProfile': { display: 'My Profile', reply: 'Here is your profile information.' },
    'checkout': { display: 'Proceed to Checkout', reply: 'Okay, let\'s complete your order.' },
    'placeOrder': { display: 'Place Order', reply: 'Placing your order now.' },
    'saveChanges': { display: 'Save Changes', reply: 'Saving your changes.' },
    'recordOrder': { display: 'Record a Voice Order', reply: 'I\'m ready. Please list the items you want to order.' },
    'checkPrice': { display: 'Check Price', reply: 'Sure, which item\'s price do you want to check?' },
    'refresh': { display: 'Refresh Page', reply: 'Refreshing the page now.' },
    'acceptDeliveryJob': { display: 'Accept Delivery Job', reply: 'Accepting the first available job.' },
    'homeAddress': { display: 'Use Home Address', reply: 'Setting delivery to your home address.' },
    'currentLocation': { display: 'Use Current Location', reply: 'Using your current location for delivery.' },
    'help': { display: 'Help / Commands', reply: 'You can say things like "order 1 kilo of onions", "go to my cart", "check price of tomatoes", or "find stores near me". What would you like to do?' },
    'who-are-you': { display: 'Who Are You?', reply: 'I am the LocalBasket voice assistant, here to make your grocery shopping faster and easier.' },
    'how-it-works': { display: 'How It Works', reply: 'Just tell me what you want to order, which store you want it from, and where to deliver it. I will handle the rest!' }
};
