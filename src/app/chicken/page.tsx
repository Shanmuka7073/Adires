'use client';
import React from 'react';

// Main App Component
const ChickenAnimationPage = () => {
  return (
    <>
      <style jsx global>{`
        /* Custom CSS for the Chicken Body and Animation */
        
        .chicken-page-body {
            background-color: #e0f2f1; /* Light mint green background */
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: calc(100vh - 128px); /* Adjust for header/footer */
            overflow: hidden;
            font-family: 'Inter', sans-serif;
        }

        /* --- Chicken Container and Movement --- */
        .chicken-container {
            position: relative;
            width: 100%;
            height: 150px;
            /* Animation: Moves the chicken horizontally */
            animation: waddle-path 10s linear infinite alternate;
        }
        
        /* Keyframes for the chicken's main travel path */
        @keyframes waddle-path {
            0% { transform: translateX(-40vw); }
            100% { transform: translateX(40vw); }
        }

        /* --- Individual Chicken Parts --- */
        .chicken {
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            /* Animation: Wobbles the entire body for a waddle effect */
            animation: wobble 0.5s ease-in-out infinite;
        }
        
        /* Keyframes for the waddle wobble */
        @keyframes wobble {
            0% { transform: rotate(-3deg) translateX(-50%); }
            50% { transform: rotate(3deg) translateX(-50%); }
            100% { transform: rotate(-3deg) translateX(-50%); }
        }

        /* Body (White oval) */
        .body {
            width: 100px;
            height: 80px;
            background-color: #ffffff;
            border-radius: 50%;
            border: 4px solid #333;
        }

        /* Head (Smaller white circle) */
        .head {
            position: absolute;
            width: 35px;
            height: 35px;
            background-color: #ffffff;
            border-radius: 50%;
            border: 3px solid #333;
            top: -25px;
            right: -5px;
            transform: rotate(15deg);
        }

        /* Beak (Yellow triangle) */
        .beak {
            position: absolute;
            width: 0;
            height: 0;
            border-left: 10px solid transparent;
            border-right: 10px solid transparent;
            border-top: 15px solid #ffcc00;
            top: 20px;
            right: -20px;
            transform: rotate(90deg);
        }

        /* Comb (Red) */
        .comb {
            position: absolute;
            width: 5px;
            height: 15px;
            background-color: #e74c3c; /* Red */
            border-radius: 50% 50% 0 0;
            top: -5px;
            right: 10px;
            transform: rotate(-15deg);
        }
        
        /* Wattle/Gills (Small red shape) */
        .wattle {
            position: absolute;
            width: 8px;
            height: 8px;
            background-color: #e74c3c;
            border-radius: 50%;
            top: 30px;
            right: -10px;
            transform: rotate(30deg);
        }

        /* Eye (Black dot) */
        .eye {
            position: absolute;
            width: 5px;
            height: 5px;
            background-color: #333;
            border-radius: 50%;
            top: 10px;
            right: 10px;
        }

        /* Legs (Orange lines) */
        .leg {
            position: absolute;
            width: 5px;
            height: 15px;
            background-color: #ffa500; /* Orange */
            bottom: -15px;
            border-radius: 0 0 5px 5px;
        }
        
        /* Front Leg Animation */
        .leg.front {
            left: 20px;
            /* Animation: Moves the leg back and forth */
            animation: leg-swing 0.5s ease-in-out infinite alternate;
        }
        
        /* Back Leg Animation */
        .leg.back {
            left: 60px;
            /* Animation: Moves the leg in opposite phase */
            animation: leg-swing 0.5s ease-in-out infinite alternate-reverse;
        }

        /* Keyframes for leg movement */
        @keyframes leg-swing {
            0% { transform: rotate(-20deg); }
            100% { transform: rotate(20deg); }
        }

        /* Tailwind utility for the banner */
        .banner {
            position: absolute;
            top: 20px;
            padding: 1rem 2rem;
            background-color: #10b981; /* Emerald Green */
            color: white;
            border-radius: 0.75rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
      `}</style>
      <div className="chicken-page-body">
        <div className="banner">
            <h1 className="text-2xl font-bold">The Waddling Groceries Chicken!</h1>
        </div>

        {/* The animated chicken container */}
        <div className="chicken-container">
            <div className="chicken">
                <div className="body">
                    <div className="head">
                        <div className="comb"></div>
                        <div className="wattle"></div>
                        <div className="eye"></div>
                        <div className="beak"></div>
                    </div>
                </div>
                <div className="leg front"></div>
                <div className="leg back"></div>
            </div>
        </div>
      </div>
    </>
  );
};

export default ChickenAnimationPage;
