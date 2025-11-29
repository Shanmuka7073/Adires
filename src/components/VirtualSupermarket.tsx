
'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * VirtualSupermarket.tsx
 *  - 2D virtual supermarket demo
 *  - Left/Right navigation, mascot picks item and item flies to cart
 *  - No external assets required
 */

type Product = {
  id: string;
  name: string;
  price: number;
  weightLabel?: string;
  emoji?: string; // placeholder visual
};

const SAMPLE_PRODUCTS: Product[] = [
  { id: 'onions', name: 'Onions', price: 50, weightLabel: '1 kg', emoji: '🧅' },
  { id: 'carrot', name: 'Carrot', price: 30, weightLabel: '1 kg', emoji: '🥕' },
  { id: 'coriander', name: 'Coriander Leaves', price: 15, weightLabel: '100 g', emoji: '🌿' },
  { id: 'sunflower', name: 'Sunflower Oil', price: 155, weightLabel: '1 l', emoji: '🛢️' },
  { id: 'ghee', name: 'Ghee', price: 550, weightLabel: '1 l', emoji: '🧈' },
  { id: 'beans', name: 'Beans', price: 90, weightLabel: '1 kg', emoji: '🫑' },
  // replicate to make aisle longer
  { id: 'dal', name: 'Urad Dal', price: 120, weightLabel: '1 kg', emoji: '🥣' },
  { id: 'rice', name: 'Basmati Rice', price: 70, weightLabel: '1 kg', emoji: '🍚' },
];

export default function VirtualSupermarket() {
  const [offset, setOffset] = useState(0); // scroll offset for aisle
  const [cart, setCart] = useState<Record<string, { product: Product; qty: number }>>({});
  const aisleRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mascotRef = useRef<HTMLDivElement | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // clamp offset helper
  const clampOffset = (val: number) => {
    const viewportWidth = viewportRef.current?.clientWidth || 360;
    const aisleWidth = aisleRef.current?.scrollWidth || 1000;
    const max = Math.max(0, aisleWidth - viewportWidth);
    return Math.min(max, Math.max(0, val));
  };

  useEffect(() => {
    // keyboard left / right
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') moveLeft();
      if (e.key === 'ArrowRight') moveRight();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const moveLeft = () => {
    setOffset((o) => clampOffset(o - 220));
  };
  const moveRight = () => {
    setOffset((o) => clampOffset(o + 220));
  };

  // Add product to cart (with flying animation)
  const addToCartAnimated = async (productId: string, productEl: HTMLElement | null) => {
    if (!productEl || !mascotRef.current) {
      addToCartSimple(productId);
      return;
    }

    // create clone
    const rect = productEl.getBoundingClientRect();
    const mascotRect = mascotRef.current.getBoundingClientRect();
    const cartBtn = document.getElementById('vb-cart-button')!;
    const cartRect = cartBtn?.getBoundingClientRect();

    const clone = productEl.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.zIndex = '9999';
    clone.style.transition = 'transform 650ms cubic-bezier(.2,.9,.2,1), opacity 650ms';
    clone.style.borderRadius = '12px';
    clone.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
    document.body.appendChild(clone);

    // force reflow then transform
    requestAnimationFrame(() => {
      const dx = (cartRect!.left + cartRect!.width / 2) - (rect.left + rect.width / 2);
      const dy = (cartRect!.top + cartRect!.height / 2) - (rect.top + rect.height / 2);
      clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.2) rotate(10deg)`;
      clone.style.opacity = '0.02';
    });

    setIsWalking(true);
    setTimeout(() => setIsWalking(false), 700);

    // cleanup and add to real cart
    setTimeout(() => {
      document.body.removeChild(clone);
      addToCartSimple(productId);
      setMessage(`Added ${SAMPLE_PRODUCTS.find(p => p.id === productId)?.name} to cart`);
      setTimeout(() => setMessage(null), 1500);
    }, 750);
  };

  const addToCartSimple = (productId: string) => {
    const p = SAMPLE_PRODUCTS.find((s) => s.id === productId)!;
    setCart((c) => {
      const prev = c[productId]?.qty || 0;
      return {
        ...c,
        [productId]: { product: p, qty: prev + 1 }
      };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((c) => {
      const entry = c[productId];
      if (!entry) return c;
      if (entry.qty <= 1) {
        const n = { ...c };
        delete n[productId];
        return n;
      }
      return { ...c, [productId]: { product: entry.product, qty: entry.qty - 1 } };
    });
  };

  const total = Object.values(cart).reduce((s, e) => s + e.product.price * e.qty, 0);

  // on product click: try animated add
  const handlePick = (productId: string, ev: React.MouseEvent) => {
    const el = (ev.currentTarget as HTMLElement).querySelector('.vs-product-card') as HTMLElement | null;
    addToCartAnimated(productId, el);
  };

  return (
    <div style={styles.container}>
      {/* Top bar */}
      <div style={styles.topbar}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>LocalBasket — Virtual Supermarket</div>
        <div id="vb-cart-button" style={styles.cartButton}>
          🛒 <span style={{ marginLeft: 8, fontWeight: 700 }}>{Object.keys(cart).length}</span>
          <div style={styles.cartTotal}>₹{total.toFixed(2)}</div>
        </div>
      </div>

      {/* Message */}
      {message && <div style={styles.toast}>{message}</div>}

      {/* Viewport + controls */}
      <div style={styles.viewportWrap}>
        <button aria-label="left" onClick={moveLeft} style={{ ...styles.sideButton, left: 6 }}>◀</button>

        <div ref={viewportRef} style={styles.viewport}>
          <div
            ref={aisleRef}
            style={{ ...styles.aisle, transform: `translateX(-${offset}px)` }}
          >
            {/* left shelf / aisle decorative */}
            <div style={styles.shelfLabel}>Aisle</div>

            {/* product cards */}
            {SAMPLE_PRODUCTS.map((p) => (
              <div key={p.id} style={styles.productSlot}>
                <div
                  className="vs-product-card"
                  onClick={(e) => handlePick(p.id, e)}
                  style={styles.productCard}
                >
                  <div style={styles.emoji}>{p.emoji ?? '📦'}</div>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{p.weightLabel}</div>
                  <div style={{ marginTop: 8, fontWeight: 700 }}>₹{p.price}</div>
                </div>
              </div>
            ))}

            {/* right end spacer */}
            <div style={{ width: 48 }} />
          </div>
        </div>

        <button aria-label="right" onClick={moveRight} style={{ ...styles.sideButton, right: 6 }}>▶</button>
      </div>

      {/* mascot & ground */}
      <div style={styles.playground}>
        <div ref={mascotRef} style={{ ...styles.mascot, ...(isWalking ? styles.mascotWalking : {}) }}>
          {/* mascot can be a svg or animated sprite; simple emoji here */}
          <div style={styles.mascotFace}>🛍️</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Shopper</div>
        </div>
        <div style={styles.ground} />
      </div>

      {/* cart sidebar */}
      <div style={styles.cartSidebar}>
        <div style={styles.cartHeader}>
          <div style={{ fontWeight: 800 }}>Cart</div>
          <div style={{ color: '#888' }}>{Object.keys(cart).length} items</div>
        </div>

        <div style={styles.cartList}>
          {Object.values(cart).length === 0 && <div style={{ color: '#777' }}>Your cart is empty</div>}
          {Object.entries(cart).map(([id, entry]) => (
            <div key={id} style={styles.cartItem}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={styles.cartEmoji}>{entry.product.emoji}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{entry.product.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{entry.product.weightLabel}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => removeFromCart(id)} style={styles.smallBtn}>-</button>
                <div>{entry.qty}</div>
                <button onClick={() => addToCartSimple(id)} style={styles.smallBtn}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.checkoutRow}>
          <div>
            <div style={{ fontSize: 12, color: '#666' }}>Total</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>₹{total.toFixed(2)}</div>
          </div>
          <button style={styles.checkoutBtn} onClick={() => alert('Checkout flow — implement your payment / order logic')}>
            Checkout
          </button>
        </div>
      </div>

      {/* instructions */}
      <div style={styles.hintBar}>
        <div>Try: tap product to pick (flying animation) • arrow keys or buttons to move aisle • mobile: swipe left/right</div>
      </div>
    </div>
  );
}

/* ------- Inline styles (simple & self-contained) ------- */

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
    maxWidth: 980,
    margin: '16px auto',
    padding: 12,
    position: 'relative',
    color: '#0f172a'
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  cartButton: {
    background: 'linear-gradient(180deg,#fff 0%,#f6f9f3 100%)',
    borderRadius: 12,
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 6px 18px rgba(16,24,40,0.06)',
    position: 'relative'
  },
  cartTotal: {
    fontSize: 12,
    color: '#067f56',
    marginLeft: 8
  },
  toast: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    top: 68,
    background: '#062f4f',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: 8,
    zIndex: 999
  },
  viewportWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    marginTop: 6
  },
  sideButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    border: 'none',
    background: 'rgba(0,0,0,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    cursor: 'pointer',
    position: 'absolute',
    zIndex: 30,
  },
  viewport: {
    overflow: 'hidden',
    width: '100%',
    borderRadius: 12,
    border: '1px solid rgba(15,23,42,0.06)',
    background: '#f6fbf6'
  },
  aisle: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 24px',
    gap: 18,
    transition: 'transform 420ms cubic-bezier(.2,.9,.2,1)'
  },
  shelfLabel: {
    minWidth: 60,
    color: '#064e3b',
    fontWeight: 800,
    paddingRight: 12
  },
  productSlot: {
    width: 160,
    flex: '0 0 160px'
  },
  productCard: {
    background: '#fff',
    borderRadius: 12,
    padding: 12,
    textAlign: 'center',
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(2,6,23,0.04)',
    userSelect: 'none'
  },
  emoji: {
    fontSize: 36,
    marginBottom: 8
  },
  playground: {
    marginTop: 18,
    height: 120,
    position: 'relative'
  },
  mascot: {
    position: 'absolute',
    left: 28,
    bottom: 28,
    width: 84,
    height: 84,
    background: 'linear-gradient(180deg,#fff,#f3fff6)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 34px rgba(12,34,12,0.05)',
    transition: 'transform 300ms',
    flexDirection: 'column'
  },
  mascotWalking: {
    transform: 'translateX(12px) translateY(-6px)',
  },
  mascotFace: {
    fontSize: 32
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 12,
    background: 'linear-gradient(90deg,#f0f9f1,#f7fff9)',
    borderRadius: 6
  },
  cartSidebar: {
    position: 'fixed',
    right: 12,
    top: 92,
    width: 260,
    background: '#fff',
    borderRadius: 12,
    padding: 12,
    boxShadow: '0 18px 46px rgba(2,6,23,0.08)',
    zIndex: 80
  },
  cartHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8
  },
  cartList: {
    maxHeight: 300 as number,
    overflow: 'auto' as 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    paddingRight: 6
  },
  cartItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    background: '#fbfff9'
  },
  cartEmoji: {
    fontSize: 26
  },
  smallBtn: {
    borderRadius: 6,
    border: '1px solid rgba(2,6,23,0.06)',
    padding: '4px 8px',
    background: '#fff',
    cursor: 'pointer'
  },
  checkoutRow: {
    marginTop: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  checkoutBtn: {
    background: '#ff7a18',
    color: '#fff',
    border: 'none',
    padding: '10px 12px',
    borderRadius: 8,
    cursor: 'pointer'
  },
  hintBar: {
    marginTop: 14,
    padding: 10,
    borderRadius: 8,
    background: '#f7fdf7',
    border: '1px dashed rgba(4,120,87,0.06)'
  }
};
