'use client';
import React from 'react';

// Main App Component
const FlashyChickenPage = () => {
  return (
    <>
      <style jsx>{`
        /* Setup */
        .chicken-page-container {
            background-color: #f0fdf4; /* Pale Green/Mint Background */
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: calc(100vh - 200px); /* Adjust for header/footer */
            overflow: hidden;
            font-family: 'Inter', sans-serif;
            border-radius: 0.5rem;
            width: 100%;
        }
        
        /* --- 1. Movement Path (Horizontal Waddle) --- */
        .chicken-container {
            position: relative;
            width: 100%;
            height: 200px;
            /* Moves chicken across the screen */
            animation: waddle-path 12s ease-in-out infinite alternate;
        }

        @keyframes waddle-path {
            0% { transform: translateX(-45vw); }
            100% { transform: translateX(45vw); }
        }

        /* --- 2. Inner Wobble (Waddle Effect) --- */
        .chicken-svg {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform-origin: bottom center;
            /* Wobbles the body slightly */
            animation: wobble 0.6s ease-in-out infinite;
        }
        
        @keyframes wobble {
            0% { transform: scale(1) rotate(-2deg); }
            50% { transform: scale(1.02) rotate(2deg); }
            100% { transform: scale(1) rotate(-2deg); }
        }

        /* --- 3. Wing Flap Animation --- */
        #wing {
            transform-origin: 50% 50%;
            /* Flaps the wing up and down for movement */
            animation: flap 0.3s ease-in-out infinite alternate;
        }

        @keyframes flap {
            0% { transform: rotate(-5deg); }
            100% { transform: rotate(15deg); }
        }

        /* --- 4. Leg Stride Animation --- */
        #left-leg {
            animation: stride 0.6s ease-in-out infinite alternate;
            transform-origin: top;
        }
        
        #right-leg {
            animation: stride 0.6s ease-in-out infinite alternate-reverse;
            transform-origin: top;
        }
        
        @keyframes stride {
            0% { transform: rotate(-15deg); }
            100% { transform: rotate(15deg); }
        }

        /* Styles for the banner */
        .banner {
            margin-bottom: 2rem;
            padding: 1rem 2rem;
            background: linear-gradient(135deg, #f97316, #ef4444); /* Orange to Red Gradient */
            color: white;
            border-radius: 0.75rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
            font-weight: bold;
            text-align: center;
        }
      `}</style>
      <div className="chicken-page-container">
        <div className="banner">
            <h1 className="text-3xl">Flashy Animated Chicken!</h1>
            <p className="text-sm">Using SVG for high-quality graphics and CSS for smooth motion.</p>
        </div>

        {/* The animated chicken container */}
        <div className="chicken-container">
            {/* SVG Chicken Graphic */}
            <svg className="chicken-svg" width="120" height="150" viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Feet/Legs (Must be positioned first so they appear behind the body) */}
                <g id="right-leg" transform="translate(70, 100)">
                    <rect x="0" y="0" width="10" height="40" rx="3" fill="#ffa500" />
                    <path d="M-5 40 L 15 40 L 5 50 L -15 50 Z" fill="#e67e22" />
                </g>
                <g id="left-leg" transform="translate(45, 100)">
                    <rect x="0" y="0" width="10" height="40" rx="3" fill="#ffa500" />
                    <path d="M-5 40 L 15 40 L 5 50 L -15 50 Z" fill="#e67e22" />
                </g>
                
                {/* Body (Gradient Fill) */}
                <defs>
                    <radialGradient id="chickenGradient" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
                        <stop offset="0%" stopColor="#ffffff"/>
                        <stop offset="100%" stopColor="#f0f0f0"/>
                    </radialGradient>
                </defs>
                <ellipse cx="60" cy="70" rx="55" ry="60" fill="url(#chickenGradient)" stroke="#333333" strokeWidth="2"/>
                
                {/* Wing (Flapping) */}
                <path id="wing" d="M 80 80 C 100 60, 100 100, 70 110 L 60 90 Z" fill="#fcfcfc" stroke="#333333" strokeWidth="2"/>

                {/* Head */}
                <circle cx="95" cy="40" r="20" fill="#ffffff" stroke="#333333" strokeWidth="2"/>
                
                {/* Beak */}
                <path d="M 105 40 L 115 45 L 105 50 Z" fill="#ffcc00"/>
                
                {/* Comb (Wattles) */}
                <path d="M 90 25 C 95 15, 105 15, 110 25" fill="#e74c3c" stroke="#333333" strokeWidth="1"/>
                <path d="M 90 55 C 95 65, 105 65, 110 55" fill="#e74c3c"/>

                {/* Eye */}
                <circle cx="90" cy="40" r="3" fill="#333333"/>
                
            </svg>
        </div>
      </div>
    </>
  );
};

export default FlashyChickenPage;
