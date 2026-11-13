// Keyclick simulation — copied verbatim from website/js/script.js
// (website keyboard-viz call removed; that renderer lives on the site page).
document.addEventListener('DOMContentLoaded', function() {
// Simulation Logic
const SIM_PAGES = {
    'explore': {
        url: 'https://keypilot.io/explore',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link active-element" data-target="explore">Explore</a>
                    <a href="#" class="mock-link" data-target="news">News</a>
                    <a href="#" class="mock-link" data-target="shop">Shop</a>
                    <a href="#" class="mock-link" data-target="apps">Apps</a>
                    <!-- <a href="#" class="mock-link" data-target="help">Help</a> -->
                </div>
                <h3>Recommended for You</h3>
                <br/>
                <div class="mock-grid">
                    <div class="mock-card" data-target="news">
                        <h4>Global News</h4>
                        <p>Stay updated with the latest headlines.</p>
                    </div>
                    <div class="mock-card" data-target="shop">
                        <h4>New Arrivals</h4>
                        <p>Check out our latest products.</p>
                    </div>
                    <div class="mock-card" data-target="apps">
                        <h4>Productivity</h4>
                        <p>Tools to help you get things done.</p>
                    </div>
                </div>
            </div>
        `
    },
    'news': {
        url: 'https://keypilot.io/news',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="explore">Explore</a>
                    <a href="#" class="mock-link active-element" data-target="news">News</a>
                    <a href="#" class="mock-link" data-target="shop">Shop</a>
                    <a href="#" class="mock-link" data-target="apps">Apps</a>
                </div>
                <h3>Latest Headlines</h3>
                <br/>
                <div class="mock-card" style="width: 100%; margin-bottom: 1rem;" data-target="article1">
                    <h4>Technology Breakthrough</h4>
                    <p>Scientists discover a new way to process data at light speed.</p>
                    <small style="color: var(--text-muted);">Click with F to read full article</small>
                </div>
                <div class="mock-card" style="width: 100%; margin-bottom: 1rem;" data-target="article2">
                    <h4>Market Update</h4>
                    <p>Global markets see a steady rise in the third quarter.</p>
                    <small style="color: var(--text-muted);">Click with F to read full article</small>
                </div>
                <div class="mock-card" style="width: 100%;" data-target="article3">
                    <h4>Climate Report</h4>
                    <p>New study highlights the impact of renewable energy.</p>
                    <small style="color: var(--text-muted);">Click with F to read full article</small>
                </div>
            </div>
        `
    },
    'article1': {
        url: 'https://keypilot.io/news/technology-breakthrough',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="news">← Back to News</a>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem;">
                    <h2 style="margin-bottom: 1rem; color: var(--primary);">Technology Breakthrough: Light-Speed Data Processing</h2>
                    <p style="color: var(--text-muted); margin-bottom: 2rem; font-size: 0.9rem;">Published: March 15, 2025 | By: Tech News Team</p>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem; font-size: 1.1rem;">
                            In a groundbreaking development that could revolutionize computing as we know it, scientists at the Quantum Computing Institute have announced the successful demonstration of data processing at light speed using quantum-entangled particles.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            The research team, led by Dr. Sarah Chen, has spent the past five years developing a new method that leverages quantum entanglement to process information instantaneously across vast distances. "This isn't just about speed," Dr. Chen explained in a press conference. "It's about fundamentally changing how we think about computation and information transfer."
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            The breakthrough involves creating stable quantum states that can maintain coherence for extended periods, allowing for complex calculations that would take traditional computers years to complete. Early tests show processing speeds that are orders of magnitude faster than current supercomputers.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            Industry experts are already speculating about potential applications. "This could transform everything from weather forecasting to drug discovery," said Professor James Mitchell of the Institute for Advanced Computing. "We're looking at problems that were previously considered unsolvable becoming tractable within our lifetimes."
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            However, the technology is still in its early stages. The current prototype requires extremely low temperatures and specialized equipment, making it impractical for widespread use. The research team estimates that it could be another decade before consumer applications become viable.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            Despite the challenges, the scientific community is optimistic. "Every major technological leap starts with a proof of concept," noted Dr. Chen. "We've proven it's possible. Now we work on making it practical."
                        </p>
                        <p style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.9rem;">
                            The full research paper will be published in the upcoming issue of Quantum Computing Review. For more information, visit the Quantum Computing Institute's website.
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'article2': {
        url: 'https://keypilot.io/news/market-update',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="news">← Back to News</a>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem;">
                    <h2 style="margin-bottom: 1rem; color: var(--primary);">Global Markets See Steady Rise in Q3</h2>
                    <p style="color: var(--text-muted); margin-bottom: 2rem; font-size: 0.9rem;">Published: March 12, 2025 | By: Financial Analysis Desk</p>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem; font-size: 1.1rem;">
                            Global financial markets have shown remarkable resilience and growth throughout the third quarter, with major indices posting consistent gains across all sectors. Analysts are calling this one of the most stable growth periods in recent memory.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            The S&P 500 closed the quarter up 8.3%, while the NASDAQ saw gains of 12.1%, driven primarily by strong performance in technology and renewable energy sectors. European markets followed suit, with the FTSE 100 and DAX both posting gains above 6%.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            "What's particularly encouraging is the breadth of this rally," said Maria Rodriguez, Chief Market Strategist at Global Financial Advisors. "We're not seeing the narrow, tech-focused growth we've seen in previous quarters. This is a broad-based recovery that touches nearly every sector."
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            The technology sector led the way with a 15% increase, but traditional industries also showed strength. Manufacturing saw a 7% boost, while healthcare and consumer goods both posted gains above 5%. Even the energy sector, which has been volatile, managed a modest 3% increase.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            International markets have been equally strong. Asian markets, particularly in Japan and South Korea, have seen robust growth. Emerging markets in Southeast Asia have also performed well, with Vietnam and Indonesia posting double-digit gains.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            Several factors have contributed to this positive trend. Central banks around the world have maintained relatively stable interest rate policies, creating an environment conducive to investment. Additionally, corporate earnings have exceeded expectations across multiple industries.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            However, some analysts remain cautious. "While the current trend is positive, we need to watch for signs of overheating," warned Dr. Robert Kim, an economist at the International Monetary Institute. "Rapid growth can sometimes mask underlying structural issues."
                        </p>
                        <p style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.9rem;">
                            Looking ahead, most analysts predict continued growth into Q4, though at a potentially more moderate pace. The focus now shifts to how markets will respond to upcoming policy decisions and global economic indicators.
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'article3': {
        url: 'https://keypilot.io/news/climate-report',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="news">← Back to News</a>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem;">
                    <h2 style="margin-bottom: 1rem; color: var(--primary);">New Study Highlights Impact of Renewable Energy</h2>
                    <p style="color: var(--text-muted); margin-bottom: 2rem; font-size: 0.9rem;">Published: March 10, 2025 | By: Environmental Science Bureau</p>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem; font-size: 1.1rem;">
                            A comprehensive new study published by the Global Climate Research Network has revealed significant positive impacts from the worldwide shift toward renewable energy sources. The findings suggest that renewable energy adoption is having measurable effects on carbon emissions and environmental health.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            The study, which analyzed data from over 150 countries over the past decade, found that regions with high renewable energy adoption rates have seen carbon emissions drop by an average of 23% compared to baseline projections. Solar and wind energy installations have been particularly effective, accounting for the majority of these reductions.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            "The data is clear and compelling," said Dr. Elena Vasquez, lead researcher on the study. "Countries that have invested heavily in renewable infrastructure are seeing real, measurable benefits. This isn't theoretical anymore—we're seeing the impact in real-time."
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            The study also examined economic impacts, finding that renewable energy sectors have created over 12 million jobs globally in the past five years. Many of these jobs are in manufacturing, installation, and maintenance—sectors that provide stable, long-term employment.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            Perhaps most encouragingly, the research shows that renewable energy is becoming increasingly cost-competitive with traditional fossil fuels. In many regions, solar and wind power are now the cheapest forms of new electricity generation, even without subsidies.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            The study highlights several success stories. Denmark, for example, now generates over 50% of its electricity from wind power. Costa Rica has run on 100% renewable energy for extended periods. Even larger economies like Germany and the United Kingdom have made significant strides, with renewable sources accounting for over 40% of their energy mix.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            However, the researchers also note significant challenges that remain. Energy storage technology needs to continue improving to handle the intermittent nature of solar and wind power. Grid infrastructure in many countries requires substantial upgrades to accommodate distributed renewable sources.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            "We're on the right track, but we can't be complacent," warned Dr. Vasquez. "The transition needs to accelerate if we're going to meet global climate targets. The good news is that the technology is ready, and the economics are increasingly favorable."
                        </p>
                        <p style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.9rem;">
                            The full study, including detailed regional breakdowns and policy recommendations, is available in the latest issue of the Journal of Climate Science. The research team plans to continue monitoring these trends and will publish annual updates.
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'shop': {
        url: 'https://keypilot.io/shop',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="explore">Explore</a>
                    <a href="#" class="mock-link" data-target="news">News</a>
                    <a href="#" class="mock-link active-element" data-target="shop">Shop</a>
                    <a href="#" class="mock-link" data-target="apps">Apps</a>
                    <span class="mock-link" data-target="cart" style="margin-left: auto; color: var(--accent); cursor: pointer; padding: 0.5rem 1rem; border: 1px solid transparent; border-radius: 8px;">🛒 <span id="cart-count">0</span></span>
                </div>
                <h3>Store</h3>
                <br/>
                <div class="mock-grid">
                    <div class="mock-card" data-target="product-keyboard">
                        <h4>Keyboard XL</h4>
                        <p>$129.00 - Perfect for KeyPilot users.</p>
                        <br/><span class="mock-link">View Details</span>
                    </div>
                    <div class="mock-card" data-target="product-mouse">
                        <h4>Mouse Pro</h4>
                        <p>$89.00 - For when you actually need one.</p>
                        <br/><span class="mock-link">View Details</span>
                    </div>
                    <div class="mock-card" data-target="product-deskmat">
                        <h4>Desk Mat</h4>
                        <p>$29.00 - Smooth surface for navigation.</p>
                        <br/><span class="mock-link">View Details</span>
                    </div>
                </div>
            </div>
        `
    },
    'product-keyboard': {
        url: 'https://keypilot.io/shop/keyboard-xl',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="shop">← Back to Shop</a>
                    <span class="mock-link" data-target="cart" style="margin-left: auto; color: var(--accent); cursor: pointer; padding: 0.5rem 1rem; border: 1px solid transparent; border-radius: 8px;">🛒 <span id="cart-count">0</span></span>
                </div>
                <div style="display: flex; gap: 2rem; margin-top: 1rem;">
                    <div style="flex: 1; aspect-ratio: 1/1; background: rgba(4, 177, 225, 0.1); border: 1px solid var(--border); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 5rem;">⌨️</div>
                    <div style="flex: 1;">
                        <h2 style="color: var(--primary); margin-bottom: 0.5rem;">Keyboard XL</h2>
                        <h3 style="color: var(--accent); margin-bottom: 1.5rem;">$129.00</h3>
                        <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 2rem;">
                            The ultimate mechanical keyboard designed specifically for KeyPilot users. Features customizable RGB, hot-swappable switches, and dedicated shortcut keys for seamless navigation.
                        </p>
                        <div class="mock-card" data-action="buy" data-product="Keyboard XL" data-price="129.00" style="text-align: center; background: var(--primary); color: white; cursor: pointer; padding: 1rem; border-radius: 8px; font-weight: bold;">
                            Add to Cart
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    'product-mouse': {
        url: 'https://keypilot.io/shop/mouse-pro',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="shop">← Back to Shop</a>
                    <span class="mock-link" data-target="cart" style="margin-left: auto; color: var(--accent); cursor: pointer; padding: 0.5rem 1rem; border: 1px solid transparent; border-radius: 8px;">🛒 <span id="cart-count">0</span></span>
                </div>
                <div style="display: flex; gap: 2rem; margin-top: 1rem;">
                    <div style="flex: 1; aspect-ratio: 1/1; background: rgba(4, 177, 225, 0.1); border: 1px solid var(--border); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 5rem;">🖱️</div>
                    <div style="flex: 1;">
                        <h2 style="color: var(--primary); margin-bottom: 0.5rem;">Mouse Pro</h2>
                        <h3 style="color: var(--accent); margin-bottom: 1.5rem;">$89.00</h3>
                        <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 2rem;">
                            Ergonomic precision for those rare moments when you need a cursor. Features high-DPI sensor, silent clicks, and a dedicated KeyPilot toggle button.
                        </p>
                        <div class="mock-card" data-action="buy" data-product="Mouse Pro" data-price="89.00" style="text-align: center; background: var(--primary); color: white; cursor: pointer; padding: 1rem; border-radius: 8px; font-weight: bold;">
                            Add to Cart
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    'product-deskmat': {
        url: 'https://keypilot.io/shop/desk-mat',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="shop">← Back to Shop</a>
                    <span class="mock-link" data-target="cart" style="margin-left: auto; color: var(--accent); cursor: pointer; padding: 0.5rem 1rem; border: 1px solid transparent; border-radius: 8px;">🛒 <span id="cart-count">0</span></span>
                </div>
                <div style="display: flex; gap: 2rem; margin-top: 1rem;">
                    <div style="flex: 1; aspect-ratio: 1/1; background: rgba(4, 177, 225, 0.1); border: 1px solid var(--border); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 5rem;">⬛</div>
                    <div style="flex: 1;">
                        <h2 style="color: var(--primary); margin-bottom: 0.5rem;">Desk Mat</h2>
                        <h3 style="color: var(--accent); margin-bottom: 1.5rem;">$29.00</h3>
                        <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 2rem;">
                            Premium micro-weave surface optimized for both optical and laser sensors. Extra-large size provides ample space for your Keyboard XL and Mouse Pro.
                        </p>
                        <div class="mock-card" data-action="buy" data-product="Desk Mat" data-price="29.00" style="text-align: center; background: var(--primary); color: white; cursor: pointer; padding: 1rem; border-radius: 8px; font-weight: bold;">
                            Add to Cart
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    'cart': {
        url: 'https://keypilot.io/cart',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="shop">← Back to Shop</a>
                    <a href="#" class="mock-link active-element" data-target="cart">Cart</a>
                </div>
                <h3>Shopping Cart</h3>
                <br/>
                <div id="cart-items-container">
                    <!-- Cart items will be dynamically inserted here -->
                </div>
                <div class="mock-card" style="width: 100%; margin-top: 2rem; padding: 1.5rem; background: rgba(4, 177, 225, 0.1); border: 1px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="margin: 0;">Total</h4>
                        <h3 style="margin: 0; color: var(--primary);" id="cart-total">$0.00</h3>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button class="mock-link" style="flex: 1; padding: 1rem; text-align: center; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;" data-action="checkout">
                            Proceed to Checkout
                        </button>
                        <button class="mock-link" style="flex: 1; padding: 1rem; text-align: center; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 8px; cursor: pointer;" data-target="shop">
                            Continue Shopping
                        </button>
                    </div>
                </div>
            </div>
        `
    },
    'apps': {
        url: 'https://keypilot.io/apps',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="explore">Explore</a>
                    <a href="#" class="mock-link" data-target="news">News</a>
                    <a href="#" class="mock-link" data-target="shop">Shop</a>
                    <a href="#" class="mock-link active-element" data-target="apps">Apps</a>
                </div>
                <h3>Your Applications</h3>
                <br/>
                <div class="mock-grid">
                    <div class="mock-card" data-target="mail-client">
                        <h4>Mail Client</h4>
                        <p>Stay connected with your team.</p>
                    </div>
                    <div class="mock-card" data-target="calculator">
                        <h4>Calculator</h4>
                        <p>Perform quick calculations.</p>
                    </div>
                    <div class="mock-card" data-target="settings">
                        <h4>Settings</h4>
                        <p>Manage your account and preferences.</p>
                    </div>
                    <div class="mock-card" data-target="profile">
                        <h4>Profile</h4>
                        <p>View and edit your public profile.</p>
                    </div>

                </div>
            </div>
        `
    },
    'settings': {
        url: 'https://keypilot.io/settings',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="explore">Explore</a>
                    <a href="#" class="mock-link" data-target="apps">Apps</a>
                    <a href="#" class="mock-link active-element" data-target="settings">Settings</a>
                </div>
                <h3>Preferences</h3>
                <br/>
                <div class="mock-card" style="width: 100%; margin-bottom: 1rem;" data-target="theme-customization">
                    <h4>Theme Customization</h4>
                    <p>Switch between light and dark modes.</p>
                </div>
                <div class="mock-card" style="width: 100%;" data-target="privacy-controls">
                    <h4>Privacy Controls</h4>
                    <p>Manage how your data is used.</p>
                </div>
            </div>
        `
    },
    'profile': {
        url: 'https://keypilot.io/profile',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="explore">Explore</a>
                    <a href="#" class="mock-link" data-target="apps">Apps</a>
                    <a href="#" class="mock-link active-element" data-target="profile">Profile</a>
                </div>
                <h3>User Profile</h3>
                <br/>
                <div class="mock-card" style="text-align: center;">
                    <div style="width: 80px; height: 80px; background: var(--primary); border-radius: 50%; margin: 0 auto 1rem;"></div>
                    <h4>Alex Navigator</h4>
                    <p>Power User since 2025</p>
                    <br/>
                    <div style="display: flex; justify-content: center; gap: 1rem;">
                        <div class="mock-card" style="padding: 1rem;" data-target="explore">
                            <strong>1.2k</strong><br/><small>Clicks</small>
                        </div>
                        <div class="mock-card" style="padding: 1rem;" data-target="apps">
                            <strong>42</strong><br/><small>Apps</small>
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    'calculator': {
        url: 'https://keypilot.io/apps/calculator',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="explore">Explore</a>
                    <a href="#" class="mock-link" data-target="apps">← Back to Apps</a>
                    <a href="#" class="mock-link active-element" data-target="calculator">Calculator</a>
                </div>
                <h3>Calculator</h3>
                <br/>
                <div class="mock-card" style="width: 100%; max-width: 400px; margin: 0 auto;">
                    <div id="calc-display" style="background: #1a1a1a; color: #0f0; padding: 1.5rem; text-align: right; font-size: 2rem; font-family: 'Courier New', monospace; border-radius: 8px; margin-bottom: 1rem; min-height: 60px; border: 2px solid var(--primary);">0</div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="clear" style="grid-column: span 2; background: #ef4444; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">C</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="backspace" style="background: #f59e0b; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">⌫</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="/" style="background: var(--primary); color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">÷</button>
                        
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="7" style="background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">7</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="8" style="background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">8</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="9" style="background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">9</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="*" style="background: var(--primary); color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">×</button>
                        
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="4" style="background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">4</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="5" style="background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">5</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="6" style="background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">6</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="-" style="background: var(--primary); color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">−</button>
                        
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="1" style="background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">1</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="2" style="background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">2</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="3" style="background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">3</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="+" style="background: var(--primary); color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">+</button>
                        
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="0" style="grid-column: span 2; background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">0</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="." style="background: #374151; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">.</button>
                        <button class="calc-btn mock-link" data-action="calc-btn" data-calc="=" style="background: #10b981; color: white; padding: 1rem; font-size: 1.2rem; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s;">=</button>
                    </div>
                </div>
            </div>
        `
    },
    'help': {
        url: 'https://keypilot.io/help',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="explore">Explore</a>
                    <a href="#" class="mock-link active-element" data-target="help">Help</a>
                </div>
                <h3>Support Center</h3>
                <br/>
                <div class="mock-card" style="width: 100%; margin-bottom: 1rem;" data-target="explore">
                    <h4>Getting Started Guide</h4>
                    <p>Learn the basics of keyboard navigation.</p>
                </div>
                <div class="mock-card" style="width: 100%;" data-target="settings">
                    <h4>Troubleshooting</h4>
                    <p>Fix common issues with your setup.</p>
                </div>
            </div>
        `
    },
    'theme-customization': {
        url: 'https://keypilot.io/settings/theme',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="settings">← Back to Settings</a>
                    <a href="#" class="mock-link active-element" data-target="theme-customization">Theme</a>
                </div>
                <h3>Theme Customization</h3>
                <br/>
                <div class="mock-card" style="width: 100%; margin-bottom: 1rem; padding: 2rem;">
                    <h4 style="margin-bottom: 1.5rem;">Appearance Settings</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <div class="mock-card" style="text-align: center; padding: 1.5rem; background: linear-gradient(135deg, #1a2332 0%, #2a3441 100%); border: 2px solid var(--primary); cursor: pointer;" data-action="set-theme" data-theme="dark">
                            <div style="width: 40px; height: 40px; background: #1a2332; border-radius: 8px; margin: 0 auto 1rem; border: 1px solid var(--border);"></div>
                            <h5>Dark Mode</h5>
                            <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">Default theme</p>
                        </div>
                        <div class="mock-card" style="text-align: center; padding: 1.5rem; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); cursor: pointer;" data-action="set-theme" data-theme="light">
                            <div style="width: 40px; height: 40px; background: #f8fafc; border-radius: 8px; margin: 0 auto 1rem; border: 1px solid #cbd5e1;"></div>
                            <h5>Light Mode</h5>
                            <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">Easy on the eyes</p>
                        </div>
                        <div class="mock-card" style="text-align: center; padding: 1.5rem; background: linear-gradient(135deg, #0f172a 0%, #7c3aed 100%); cursor: pointer;" data-action="set-theme" data-theme="purple">
                            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #0f172a 0%, #7c3aed 100%); border-radius: 8px; margin: 0 auto 1rem; border: 1px solid #a78bfa;"></div>
                            <h5>Purple Haze</h5>
                            <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">Mystical vibes</p>
                        </div>
                    </div>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem;">
                    <h4 style="margin-bottom: 1.5rem;">Advanced Options</h4>
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(4, 177, 225, 0.1); border-radius: 8px;">
                            <div>
                                <h5>High Contrast Mode</h5>
                                <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">Enhanced visibility for accessibility</p>
                            </div>
                            <div class="mock-link" style="width: 50px; height: 24px; background: var(--surface-light); border-radius: 12px; position: relative; cursor: pointer;" data-action="toggle-contrast">
                                <div style="width: 20px; height: 20px; background: var(--primary); border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: transform 0.2s;"></div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(4, 177, 225, 0.1); border-radius: 8px;">
                            <div>
                                <h5>Reduced Motion</h5>
                                <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">Minimize animations and transitions</p>
                            </div>
                            <div class="mock-link" style="width: 50px; height: 24px; background: var(--surface-light); border-radius: 12px; position: relative; cursor: pointer;" data-action="toggle-motion">
                                <div style="width: 20px; height: 20px; background: var(--primary); border-radius: 50%; position: absolute; top: 2px; right: 2px; transition: transform 0.2s;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    'privacy-controls': {
        url: 'https://keypilot.io/settings/privacy',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="settings">← Back to Settings</a>
                    <a href="#" class="mock-link active-element" data-target="privacy-controls">Privacy</a>
                </div>
                <h3>Privacy Controls</h3>
                <br/>
                <div class="mock-card" style="width: 100%; margin-bottom: 1rem; padding: 2rem;">
                    <h4 style="margin-bottom: 1.5rem;">Data Collection</h4>
                    <div style="display: grid; gap: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(34, 197, 94, 0.1); border-radius: 8px;">
                            <div>
                                <h5>Usage Analytics</h5>
                                <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">Help improve KeyPilot by sharing anonymous usage data</p>
                            </div>
                            <div class="mock-link" style="width: 50px; height: 24px; background: #22c55e; border-radius: 12px; position: relative; cursor: pointer;" data-action="toggle-analytics">
                                <div style="width: 20px; height: 20px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 26px; transition: transform 0.2s;"></div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px;">
                            <div>
                                <h5>Crash Reporting</h5>
                                <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">Automatically send crash reports to help fix issues</p>
                            </div>
                            <div class="mock-link" style="width: 50px; height: 24px; background: #ef4444; border-radius: 12px; position: relative; cursor: pointer;" data-action="toggle-crash">
                                <div style="width: 20px; height: 20px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 26px; transition: transform 0.2s;"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mock-card" style="width: 100%; margin-bottom: 1rem; padding: 2rem;">
                    <h4 style="margin-bottom: 1.5rem;">Website Permissions</h4>
                    <div style="display: grid; gap: 1rem;">
                        <div class="mock-card" style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h5>Global Website Access</h5>
                                <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">Allow KeyPilot to work on all websites</p>
                            </div>
                            <span style="color: #22c55e; font-weight: 600;">✓ Enabled</span>
                        </div>
                        <div class="mock-card" style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h5>Incognito Mode</h5>
                                <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">Disable in private browsing windows</p>
                            </div>
                            <span style="color: #ef4444; font-weight: 600;">✗ Disabled</span>
                        </div>
                    </div>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem;">
                    <h4 style="margin-bottom: 1.5rem;">Data Management</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                        <div class="mock-card" style="text-align: center; padding: 1.5rem; cursor: pointer;" data-action="export-data">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📤</div>
                            <h5>Export Data</h5>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Download your data</p>
                        </div>
                        <div class="mock-card" style="text-align: center; padding: 1.5rem; cursor: pointer;" data-action="clear-data">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🗑️</div>
                            <h5>Clear Data</h5>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Reset all settings</p>
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    'mail-client': {
        url: 'https://keypilot.io/apps/mail',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="apps">← Back to Apps</a>
                    <a href="#" class="mock-link active-element" data-target="mail-client">Mail</a>
                </div>
                <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                    <div class="mock-link" style="padding: 0.75rem 1.5rem; background: var(--primary); color: white; border-radius: 8px; cursor: pointer;" data-action="compose">
                        ✉️ Compose
                    </div>
                    <div class="mock-link" style="padding: 0.75rem 1.5rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 8px; cursor: pointer;" data-action="refresh">
                        🔄 Refresh
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 300px 1fr; gap: 1rem; height: 500px;">
                    <div class="mock-card" style="padding: 1rem; overflow-y: auto;">
                        <h4 style="margin-bottom: 1rem;">Folders</h4>
                        <div style="display: grid; gap: 0.5rem;">
                            <div class="mock-link" style="padding: 0.75rem; background: rgba(4, 177, 225, 0.1); border-radius: 6px; cursor: pointer;" data-target="mail-inbox">
                                📬 Inbox <span style="float: right; color: var(--primary);">12</span>
                            </div>
                            <div class="mock-link" style="padding: 0.75rem; border-radius: 6px; cursor: pointer;" data-target="mail-sent">
                                📤 Sent
                            </div>
                            <div class="mock-link" style="padding: 0.75rem; border-radius: 6px; cursor: pointer;" data-target="mail-drafts">
                                📝 Drafts <span style="float: right; color: var(--text-muted);">3</span>
                            </div>
                            <div class="mock-link" style="padding: 0.75rem; border-radius: 6px; cursor: pointer;" data-target="mail-trash">
                                🗑️ Trash
                            </div>
                        </div>
                    </div>
                    <div class="mock-card" style="padding: 1rem; overflow-y: auto;">
                        <h4 style="margin-bottom: 1rem;">Inbox</h4>
                        <div style="display: grid; gap: 0.5rem;">
                            <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-message-1">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                    <h5 style="margin: 0; font-size: 1rem;">Welcome to KeyPilot!</h5>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">2h ago</span>
                                </div>
                                <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">from: team@keypilot.io</p>
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Thank you for installing KeyPilot! Here's how to get started...</p>
                            </div>
                            <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-message-2">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                    <h5 style="margin: 0; font-size: 1rem;">Your order confirmation</h5>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">1d ago</span>
                                </div>
                                <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">from: orders@shop.com</p>
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Order #KP-2025-001 has been confirmed and is being processed.</p>
                            </div>
                            <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-message-3">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                                    <h5 style="margin: 0; font-size: 1rem;">Weekly Newsletter</h5>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">3d ago</span>
                                </div>
                                <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">from: newsletter@techweekly.com</p>
                                <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">This week's top stories: AI breakthroughs, new programming languages...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },
    'mail-inbox': {
        url: 'https://keypilot.io/apps/mail/inbox',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-client">← Back to Mail</a>
                    <a href="#" class="mock-link active-element" data-target="mail-inbox">Inbox</a>
                </div>
                <h3 style="margin-bottom: 1rem;">Inbox (12 messages)</h3>
                <div style="display: grid; gap: 0.5rem;">
                    <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-message-1">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem; font-weight: 700;">Welcome to KeyPilot!</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">2h ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">from: team@keypilot.io</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Thank you for installing KeyPilot! Here's how to get started...</p>
                    </div>
                    <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-message-2">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem; font-weight: 700;">Your order confirmation</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">1d ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">from: orders@shop.com</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Order #KP-2025-001 has been confirmed and is being processed.</p>
                    </div>
                    <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-message-3">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem; font-weight: 700;">Weekly Newsletter</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">3d ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">from: newsletter@techweekly.com</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">This week's top stories: AI breakthroughs, new programming languages...</p>
                    </div>
                    <div class="mock-card" style="padding: 1rem; cursor: pointer; opacity: 0.7;" data-target="mail-inbox">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem;">Team meeting tomorrow</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">2d ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">from: manager@company.com</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Don't forget we have a team sync at 10 AM tomorrow...</p>
                    </div>
                    <div class="mock-card" style="padding: 1rem; cursor: pointer; opacity: 0.7;" data-target="mail-inbox">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem;">Security alert</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">3d ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">from: security@keypilot.io</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">New login detected from Chrome on Linux...</p>
                    </div>
                </div>
            </div>
        `
    },
    'mail-sent': {
        url: 'https://keypilot.io/apps/mail/sent',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-client">← Back to Mail</a>
                    <a href="#" class="mock-link active-element" data-target="mail-sent">Sent</a>
                </div>
                <h3 style="margin-bottom: 1rem;">Sent Messages</h3>
                <div style="display: grid; gap: 0.5rem;">
                    <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-sent-1">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem;">Re: Project deadline</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Yesterday</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">to: client@example.com</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Thanks for the update. We'll have everything ready by Friday...</p>
                    </div>
                    <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-sent-2">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem;">Feedback on KeyPilot</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">2d ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">to: feedback@keypilot.io</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">I've been using KeyPilot for a week now and it's amazing...</p>
                    </div>
                    <div class="mock-card" style="padding: 1rem; cursor: pointer; opacity: 0.7;" data-target="mail-sent">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem;">Invoice attached</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">1 week ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">to: accounts@vendor.com</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Please find the invoice for March attached...</p>
                    </div>
                </div>
            </div>
        `
    },
    'mail-drafts': {
        url: 'https://keypilot.io/apps/mail/drafts',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-client">← Back to Mail</a>
                    <a href="#" class="mock-link active-element" data-target="mail-drafts">Drafts</a>
                </div>
                <h3 style="margin-bottom: 1rem;">Draft Messages (3)</h3>
                <div style="display: grid; gap: 0.5rem;">
                    <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-draft-1">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem; color: var(--text-muted);">[Draft] Re: Meeting notes</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Saved 1h ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">to: team@company.com</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Here are my notes from today's discussion...</p>
                    </div>
                    <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-draft-2">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem; color: var(--text-muted);">[Draft] Feature request</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Saved 3d ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">to: support@keypilot.io</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Would it be possible to add a feature that...</p>
                    </div>
                    <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-target="mail-draft-3">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem; color: var(--text-muted);">[Draft] Newsletter signup</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Saved 1w ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">to: subscribe@techweekly.com</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">I'd like to subscribe to your weekly newsletter...</p>
                    </div>
                </div>
            </div>
        `
    },
    'mail-trash': {
        url: 'https://keypilot.io/apps/mail/trash',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-client">← Back to Mail</a>
                    <a href="#" class="mock-link active-element" data-target="mail-trash">Trash</a>
                </div>
                <h3 style="margin-bottom: 1rem;">Trash</h3>
                <div style="display: grid; gap: 0.5rem;">
                    <div class="mock-card" style="padding: 1rem; opacity: 0.6; cursor: pointer;" data-action="restore">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem; text-decoration: line-through;">Spam: You won a prize!</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">5d ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">from: noreply@spam.com</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Click here to claim your prize...</p>
                    </div>
                    <div class="mock-card" style="padding: 1rem; opacity: 0.6; cursor: pointer;" data-action="restore">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <h5 style="margin: 0; font-size: 1rem; text-decoration: line-through;">Old newsletter</h5>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">2w ago</span>
                        </div>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">from: archive@oldnews.com</p>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">Last month's digest...</p>
                    </div>
                    <div style="margin-top: 1rem; padding: 1rem; text-align: center; color: var(--text-muted);">
                        <p style="font-size: 0.9rem;">Trash is emptied automatically after 30 days</p>
                        <button class="mock-link" style="margin-top: 0.5rem; padding: 0.75rem 1.5rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; color: var(--text);" data-action="empty-trash">
                            Empty Trash Now
                        </button>
                    </div>
                </div>
            </div>
        `
    },
    'mail-message-1': {
        url: 'https://keypilot.io/apps/mail/message/1',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-inbox">← Back to Inbox</a>
                    <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;" data-action="reply">
                            ↩️ Reply
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;" data-action="forward">
                            ➡️ Forward
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: rgba(220, 38, 38, 0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; cursor: pointer;" data-action="delete-mail">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem; margin-top: 1rem;">
                    <h2 style="margin-bottom: 1.5rem; color: var(--text);">Welcome to KeyPilot!</h2>
                    <div style="display: grid; gap: 0.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">From:</strong>
                            <span style="color: var(--primary);">KeyPilot Team &lt;team@keypilot.io&gt;</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">To:</strong>
                            <span>you@example.com</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">Date:</strong>
                            <span style="color: var(--text-muted);">Today at 2:30 PM</span>
                        </div>
                    </div>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem;">Hello and welcome!</p>
                        <p style="margin-bottom: 1.5rem;">
                            Thank you for installing KeyPilot! We're excited to help you transform your browsing experience with keyboard-first navigation.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            <strong>Getting Started:</strong>
                        </p>
                        <ul style="margin-bottom: 1.5rem; padding-left: 1.5rem;">
                            <li style="margin-bottom: 0.5rem;">Press <strong>F</strong> to click any element under your cursor</li>
                            <li style="margin-bottom: 0.5rem;">Press <strong>D</strong> or <strong>S</strong> to go back in history</li>
                            <li style="margin-bottom: 0.5rem;">Press <strong>R</strong> to go forward</li>
                            <li style="margin-bottom: 0.5rem;">Press <strong>Alt+K</strong> to toggle KeyPilot on/off</li>
                        </ul>
                        <p style="margin-bottom: 1.5rem;">
                            KeyPilot automatically detects clickable elements and provides visual feedback. Just move your cursor over any link or button and press F to activate it instantly.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            If you have any questions or feedback, feel free to reach out to us at feedback@keypilot.io
                        </p>
                        <p style="margin-bottom: 0;">
                            Happy surfing!<br/>
                            <em>The KeyPilot Team</em>
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'mail-message-2': {
        url: 'https://keypilot.io/apps/mail/message/2',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-inbox">← Back to Inbox</a>
                    <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;" data-action="reply">
                            ↩️ Reply
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;" data-action="forward">
                            ➡️ Forward
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: rgba(220, 38, 38, 0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; cursor: pointer;" data-action="delete-mail">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem; margin-top: 1rem;">
                    <h2 style="margin-bottom: 1.5rem; color: var(--text);">Order Confirmation #KP-2025-001</h2>
                    <div style="display: grid; gap: 0.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">From:</strong>
                            <span style="color: var(--primary);">KeyPilot Shop &lt;orders@shop.com&gt;</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">To:</strong>
                            <span>you@example.com</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">Date:</strong>
                            <span style="color: var(--text-muted);">Yesterday at 3:45 PM</span>
                        </div>
                    </div>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem;">Dear Customer,</p>
                        <p style="margin-bottom: 1.5rem;">
                            Thank you for your order! Your purchase has been confirmed and is being processed.
                        </p>
                        <div style="background: rgba(4, 177, 225, 0.1); border: 1px solid var(--primary); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
                            <h4 style="margin-bottom: 1rem; color: var(--primary);">Order Details</h4>
                            <div style="display: grid; gap: 0.75rem;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span>Keyboard XL</span>
                                    <span>$129.00</span>
                                </div>
                                <div style="display: flex; justify-content: space-between;">
                                    <span>Mouse Pro</span>
                                    <span>$89.00</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; padding-top: 0.75rem; border-top: 1px solid var(--border); font-weight: 700;">
                                    <span>Total</span>
                                    <span>$218.00</span>
                                </div>
                            </div>
                        </div>
                        <p style="margin-bottom: 1.5rem;">
                            <strong>Shipping Address:</strong><br/>
                            123 Keyboard Lane<br/>
                            Navigation City, NC 12345<br/>
                            United States
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            Your order will be shipped within 2-3 business days. You'll receive a tracking number once your package is on its way.
                        </p>
                        <p style="margin-bottom: 0;">
                            Best regards,<br/>
                            <em>KeyPilot Shop Team</em>
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'mail-message-3': {
        url: 'https://keypilot.io/apps/mail/message/3',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-inbox">← Back to Inbox</a>
                    <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;" data-action="reply">
                            ↩️ Reply
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;" data-action="forward">
                            ➡️ Forward
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: rgba(220, 38, 38, 0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; cursor: pointer;" data-action="delete-mail">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem; margin-top: 1rem;">
                    <h2 style="margin-bottom: 1.5rem; color: var(--text);">Tech Weekly: This Week's Top Stories</h2>
                    <div style="display: grid; gap: 0.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">From:</strong>
                            <span style="color: var(--primary);">Tech Weekly &lt;newsletter@techweekly.com&gt;</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">To:</strong>
                            <span>you@example.com</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">Date:</strong>
                            <span style="color: var(--text-muted);">3 days ago at 8:00 AM</span>
                        </div>
                    </div>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem;">Welcome to this week's edition of Tech Weekly!</p>
                        
                        <h3 style="color: var(--primary); margin-bottom: 1rem;">🚀 AI Breakthroughs</h3>
                        <p style="margin-bottom: 1.5rem;">
                            Researchers have unveiled a new language model that demonstrates remarkable improvements in code generation. The model can now understand complex programming patterns and generate production-ready code with minimal human intervention.
                        </p>
                        
                        <h3 style="color: var(--primary); margin-bottom: 1rem;">💻 New Programming Languages</h3>
                        <p style="margin-bottom: 1.5rem;">
                            Two new programming languages have entered beta: Quantum++ for quantum computing applications, and WebFlow for visual web development. Both promise to simplify complex development workflows.
                        </p>
                        
                        <h3 style="color: var(--primary); margin-bottom: 1rem;">🔐 Cybersecurity Updates</h3>
                        <p style="margin-bottom: 1.5rem;">
                            Major browsers have implemented new security features to combat phishing attacks. Users will now see enhanced warnings and verification systems when visiting potentially suspicious websites.
                        </p>
                        
                        <h3 style="color: var(--primary); margin-bottom: 1rem;">📱 Mobile Innovations</h3>
                        <p style="margin-bottom: 1.5rem;">
                            The latest smartphone processors demonstrate 40% better energy efficiency while maintaining performance gains. This breakthrough could extend battery life significantly in next-generation devices.
                        </p>
                        
                        <div style="background: rgba(4, 177, 225, 0.1); border-left: 4px solid var(--primary); padding: 1rem; margin: 2rem 0;">
                            <p style="margin: 0; font-style: italic;">
                                "The future of computing lies in making powerful tools accessible to everyone. KeyPilot is a perfect example of this philosophy in action."
                            </p>
                        </div>
                        
                        <p style="margin-bottom: 0;">
                            That's all for this week! Stay tuned for more tech news.<br/>
                            <em>The Tech Weekly Team</em>
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'mail-sent-1': {
        url: 'https://keypilot.io/apps/mail/sent/1',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-sent">← Back to Sent</a>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem; margin-top: 1rem;">
                    <h2 style="margin-bottom: 1.5rem; color: var(--text);">Re: Project deadline</h2>
                    <div style="display: grid; gap: 0.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">From:</strong>
                            <span>you@example.com</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">To:</strong>
                            <span style="color: var(--primary);">client@example.com</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">Date:</strong>
                            <span style="color: var(--text-muted);">Yesterday at 4:15 PM</span>
                        </div>
                    </div>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem;">Hi Sarah,</p>
                        <p style="margin-bottom: 1.5rem;">
                            Thanks for the update on the project timeline. I appreciate your flexibility with the deadline.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            We'll have everything ready by Friday as discussed. The final deliverables will include:
                        </p>
                        <ul style="margin-bottom: 1.5rem; padding-left: 1.5rem;">
                            <li style="margin-bottom: 0.5rem;">Complete UI mockups for all screens</li>
                            <li style="margin-bottom: 0.5rem;">Responsive design specifications</li>
                            <li style="margin-bottom: 0.5rem;">Interactive prototype</li>
                            <li style="margin-bottom: 0.5rem;">Documentation and style guide</li>
                        </ul>
                        <p style="margin-bottom: 1.5rem;">
                            I'll send you a preview link on Thursday so you can review everything before the final delivery.
                        </p>
                        <p style="margin-bottom: 0;">
                            Best regards,<br/>
                            Alex
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'mail-sent-2': {
        url: 'https://keypilot.io/apps/mail/sent/2',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-sent">← Back to Sent</a>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem; margin-top: 1rem;">
                    <h2 style="margin-bottom: 1.5rem; color: var(--text);">Feedback on KeyPilot</h2>
                    <div style="display: grid; gap: 0.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">From:</strong>
                            <span>you@example.com</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">To:</strong>
                            <span style="color: var(--primary);">feedback@keypilot.io</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">Date:</strong>
                            <span style="color: var(--text-muted);">2 days ago at 10:30 AM</span>
                        </div>
                    </div>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem;">Hello KeyPilot Team,</p>
                        <p style="margin-bottom: 1.5rem;">
                            I've been using KeyPilot for about a week now, and I wanted to share my experience. In short: it's amazing!
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            <strong>What I love:</strong>
                        </p>
                        <ul style="margin-bottom: 1.5rem; padding-left: 1.5rem;">
                            <li style="margin-bottom: 0.5rem;">The F key activation is incredibly intuitive</li>
                            <li style="margin-bottom: 0.5rem;">Navigation feels so much faster than traditional clicking</li>
                            <li style="margin-bottom: 0.5rem;">The visual feedback is perfect - I always know what I'm about to click</li>
                            <li style="margin-bottom: 0.5rem;">Works seamlessly across all websites I've tried</li>
                        </ul>
                        <p style="margin-bottom: 1.5rem;">
                            <strong>Suggestions for improvement:</strong>
                        </p>
                        <ul style="margin-bottom: 1.5rem; padding-left: 1.5rem;">
                            <li style="margin-bottom: 0.5rem;">Could there be an option to customize the activation key?</li>
                            <li style="margin-bottom: 0.5rem;">A tutorial for new users would be helpful</li>
                            <li style="margin-bottom: 0.5rem;">Maybe add support for more complex gestures</li>
                        </ul>
                        <p style="margin-bottom: 1.5rem;">
                            Overall, this extension has genuinely changed how I browse the web. Thank you for building such a useful tool!
                        </p>
                        <p style="margin-bottom: 0;">
                            Best,<br/>
                            Alex Navigator
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'mail-draft-1': {
        url: 'https://keypilot.io/apps/mail/drafts/1',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-drafts">← Back to Drafts</a>
                    <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                        <button class="mock-link" style="padding: 0.5rem 1.5rem; background: var(--primary); color: white; border-radius: 6px; cursor: pointer;" data-action="send-draft">
                            📤 Send
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;" data-action="save-draft">
                            💾 Save
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: rgba(220, 38, 38, 0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; cursor: pointer;" data-action="discard-draft">
                            🗑️ Discard
                        </button>
                    </div>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem; margin-top: 1rem;">
                    <div style="background: rgba(255, 200, 0, 0.1); border: 1px solid #ffc107; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                        <strong style="color: #ffc107;">📝 Draft</strong>
                        <span style="color: var(--text-muted); margin-left: 1rem;">Last saved 1 hour ago</span>
                    </div>
                    <h2 style="margin-bottom: 1.5rem; color: var(--text);">Re: Meeting notes</h2>
                    <div style="display: grid; gap: 0.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">From:</strong>
                            <span>you@example.com</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">To:</strong>
                            <span style="color: var(--primary);">team@company.com</span>
                        </div>
                    </div>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem;">Hi team,</p>
                        <p style="margin-bottom: 1.5rem;">
                            Here are my notes from today's discussion. Feel free to add anything I might have missed.
                        </p>
                        <p style="margin-bottom: 1.5rem;">
                            <strong>Action Items:</strong>
                        </p>
                        <ul style="margin-bottom: 1.5rem; padding-left: 1.5rem;">
                            <li style="margin-bottom: 0.5rem;">[TODO: Add action items]</li>
                        </ul>
                        <p style="margin-bottom: 0; color: var(--text-muted); font-style: italic;">
                            [Draft incomplete - remember to finish before sending]
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'mail-draft-2': {
        url: 'https://keypilot.io/apps/mail/drafts/2',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-drafts">← Back to Drafts</a>
                    <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                        <button class="mock-link" style="padding: 0.5rem 1.5rem; background: var(--primary); color: white; border-radius: 6px; cursor: pointer;" data-action="send-draft">
                            📤 Send
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;" data-action="save-draft">
                            💾 Save
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: rgba(220, 38, 38, 0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; cursor: pointer;" data-action="discard-draft">
                            🗑️ Discard
                        </button>
                    </div>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem; margin-top: 1rem;">
                    <div style="background: rgba(255, 200, 0, 0.1); border: 1px solid #ffc107; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                        <strong style="color: #ffc107;">📝 Draft</strong>
                        <span style="color: var(--text-muted); margin-left: 1rem;">Last saved 3 days ago</span>
                    </div>
                    <h2 style="margin-bottom: 1.5rem; color: var(--text);">Feature request</h2>
                    <div style="display: grid; gap: 0.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">From:</strong>
                            <span>you@example.com</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">To:</strong>
                            <span style="color: var(--primary);">support@keypilot.io</span>
                        </div>
                    </div>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem;">Hello,</p>
                        <p style="margin-bottom: 1.5rem;">
                            Would it be possible to add a feature that allows customizing the keyboard shortcuts?
                        </p>
                        <p style="margin-bottom: 0; color: var(--text-muted); font-style: italic;">
                            [Need to elaborate more on this request...]
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'mail-draft-3': {
        url: 'https://keypilot.io/apps/mail/drafts/3',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-drafts">← Back to Drafts</a>
                    <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                        <button class="mock-link" style="padding: 0.5rem 1.5rem; background: var(--primary); color: white; border-radius: 6px; cursor: pointer;" data-action="send-draft">
                            📤 Send
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;" data-action="save-draft">
                            💾 Save
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: rgba(220, 38, 38, 0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; cursor: pointer;" data-action="discard-draft">
                            🗑️ Discard
                        </button>
                    </div>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem; margin-top: 1rem;">
                    <div style="background: rgba(255, 200, 0, 0.1); border: 1px solid #ffc107; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                        <strong style="color: #ffc107;">📝 Draft</strong>
                        <span style="color: var(--text-muted); margin-left: 1rem;">Last saved 1 week ago</span>
                    </div>
                    <h2 style="margin-bottom: 1.5rem; color: var(--text);">Newsletter signup</h2>
                    <div style="display: grid; gap: 0.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;">
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">From:</strong>
                            <span>you@example.com</span>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <strong style="min-width: 80px; color: var(--text-muted);">To:</strong>
                            <span style="color: var(--primary);">subscribe@techweekly.com</span>
                        </div>
                    </div>
                    <div style="line-height: 1.8; color: var(--text-secondary);">
                        <p style="margin-bottom: 1.5rem;">Hello,</p>
                        <p style="margin-bottom: 0;">
                            I'd like to subscribe to your weekly newsletter. Please add me to your mailing list.
                        </p>
                    </div>
                </div>
            </div>
        `
    },
    'compose-mail': {
        url: 'https://keypilot.io/apps/mail/compose',
        content: `
            <div class="mock-page">
                <div class="mock-nav">
                    <a href="#" class="mock-link" data-target="mail-client">← Back to Mail</a>
                    <div style="display: flex; gap: 0.5rem; margin-left: auto;">
                        <button class="mock-link" style="padding: 0.5rem 1.5rem; background: var(--primary); color: white; border-radius: 6px; cursor: pointer;" data-action="send-composed-mail">
                            📤 Send
                        </button>
                        <button class="mock-link" style="padding: 0.5rem 1rem; background: var(--surface-light); border: 1px solid var(--border); border-radius: 6px; cursor: pointer;" data-target="mail-client">
                            Cancel
                        </button>
                    </div>
                </div>
                <div class="mock-card" style="width: 100%; padding: 2rem; margin-top: 1rem;">
                    <h2 style="margin-bottom: 1.5rem; color: var(--text);">Compose New Message</h2>
                    <div style="display: grid; gap: 1.5rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; color: var(--text); font-weight: 600;">To:</label>
                            <input type="text" id="compose-to" placeholder="recipient@example.com" style="width: 100%; background: var(--background); border: 1px solid var(--border); padding: 0.75rem; color: var(--text); border-radius: 6px; font-family: var(--font-body); font-size: 1rem;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; color: var(--text); font-weight: 600;">Subject:</label>
                            <input type="text" id="compose-subject" placeholder="Enter subject" style="width: 100%; background: var(--background); border: 1px solid var(--border); padding: 0.75rem; color: var(--text); border-radius: 6px; font-family: var(--font-body); font-size: 1rem;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; color: var(--text); font-weight: 600;">Message:</label>
                            <textarea id="compose-message" placeholder="Type your message here..." style="width: 100%; min-height: 300px; background: var(--background); border: 1px solid var(--border); padding: 0.75rem; color: var(--text); border-radius: 6px; font-family: var(--font-body); font-size: 1rem; resize: vertical; line-height: 1.6;"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        `
    }
};


const simContent = document.getElementById('sim-content');
const simUrl = document.getElementById('sim-url');
const simContainer = document.getElementById('sim-container');
const simSearch = document.getElementById('sim-search');
const simSearchInput = document.getElementById('sim-search-input');
const simInstruction = document.querySelector('.sim-instruction');

let simHistory = [];
let currentSimPage = 'explore';
let cartItems = [];
let isSearching = false;
let isTextMode = false;
let userSentMessages = [];

// Text mode functions
function enterTextMode() {
    isTextMode = true;
    if (simInstruction) {
        simInstruction.innerHTML = 'Text Mode: Press <span style="color: var(--accent); font-weight: bold;">ESC</span> to exit and return to navigation';
        
        // Add pulse animation to draw attention
        simInstruction.classList.add('pulse');
        
        // Remove pulse class after animation completes (3 iterations × 1s = 3s)
        setTimeout(() => {
            simInstruction.classList.remove('pulse');
        }, 3000);
    }
}

function exitTextMode() {
    isTextMode = false;
    if (simInstruction) {
        simInstruction.innerHTML = 'Move mouse and press <span style="color: var(--accent); font-weight: bold;">F</span> to click &nbsp;&bull;&nbsp; Press <span style="color: var(--accent); font-weight: bold;">D</span> to go back';
    }
}

// Add event listeners to text inputs/textareas for text mode
function attachTextModeListeners() {
    const textInputs = simContainer.querySelectorAll('input[type="text"], textarea');
    textInputs.forEach(input => {
        input.addEventListener('focus', enterTextMode);
        input.addEventListener('blur', exitTextMode);
    });
}

// Flash message function
function showFlashMessage(message, type = 'info', duration = 3000) {
    const flashEl = document.getElementById('sim-flash');
    if (!flashEl) return;

    flashEl.textContent = message;
    flashEl.className = 'sim-flash-message';

    // Add type class
    if (type !== 'info') {
        flashEl.classList.add(type);
    }

    // Show message
    setTimeout(() => flashEl.classList.add('show'), 10);

    // Hide message after duration
    setTimeout(() => {
        flashEl.classList.remove('show');
        setTimeout(() => {
            flashEl.className = 'sim-flash-message';
        }, 300);
    }, duration);
}

// Modal functions
let modalCallback = null;

function showModal(title, message, confirmCallback, confirmText = 'Confirm', cancelText = 'Cancel') {
    const modal = document.getElementById('sim-modal');
    const titleEl = document.getElementById('sim-modal-title');
    const messageEl = document.getElementById('sim-modal-message');
    const confirmBtn = document.getElementById('sim-modal-confirm');
    const cancelBtn = document.getElementById('sim-modal-cancel');

    if (!modal || !titleEl || !messageEl) return;

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    modalCallback = confirmCallback;

    modal.classList.add('show');
}

function hideModal() {
    const modal = document.getElementById('sim-modal');
    if (modal) {
        modal.classList.remove('show');
        modalCallback = null;
    }
}



function updateCartCount() {
    const countEl = document.getElementById('cart-count');
    if (countEl) {
        countEl.textContent = cartItems.length;
    }
}

// Calculator state and functionality
let calculatorState = {
    currentValue: '0',
    previousValue: null,
    operation: null,
    shouldResetDisplay: false,
    secondValue: ''  // Track the second operand separately
};

function initCalculator() {
    // Reset calculator state when page loads
    calculatorState = {
        currentValue: '0',
        previousValue: null,
        operation: null,
        shouldResetDisplay: false,
        secondValue: ''
    };
    
    const display = document.getElementById('calc-display');
    if (display) {
        display.textContent = '0';
    }
}

function updateCalcDisplay() {
    const display = document.getElementById('calc-display');
    if (display) {
        display.textContent = calculatorState.currentValue;
    }
}

function handleCalcNumber(num) {
    if (calculatorState.shouldResetDisplay) {
        // If we just pressed an operator, start building the second number
        calculatorState.secondValue = num;
        calculatorState.currentValue += num;
        calculatorState.shouldResetDisplay = false;
    } else if (calculatorState.currentValue === '0') {
        calculatorState.currentValue = num;
        calculatorState.secondValue = num;
    } else {
        calculatorState.currentValue += num;
        // If we're building the second operand, update it
        if (calculatorState.operation !== null) {
            calculatorState.secondValue += num;
        }
    }
    updateCalcDisplay();
}

function handleCalcOperator(op) {
    if (calculatorState.previousValue !== null && calculatorState.operation !== null && !calculatorState.shouldResetDisplay) {
        calculateResult();
    }
    
    // Store the first operand (use secondValue if we were building a second number, otherwise use currentValue)
    calculatorState.previousValue = calculatorState.operation !== null && calculatorState.secondValue 
        ? calculatorState.secondValue 
        : calculatorState.currentValue;
    calculatorState.operation = op;
    calculatorState.secondValue = '';
    calculatorState.shouldResetDisplay = true;
    
    // Display the operator
    const operatorDisplay = {
        '+': ' + ',
        '-': ' − ',
        '*': ' × ',
        '/': ' ÷ '
    };
    calculatorState.currentValue = calculatorState.previousValue + (operatorDisplay[op] || ` ${op} `);
    updateCalcDisplay();
}

function calculateResult() {
    if (calculatorState.previousValue === null || calculatorState.operation === null) return;
    
    const prev = parseFloat(calculatorState.previousValue);
    const current = parseFloat(calculatorState.secondValue || calculatorState.currentValue);
    let result;
    
    switch(calculatorState.operation) {
        case '+':
            result = prev + current;
            break;
        case '-':
            result = prev - current;
            break;
        case '*':
            result = prev * current;
            break;
        case '/':
            result = current !== 0 ? prev / current : 'Error';
            break;
        default:
            return;
    }
    
    calculatorState.currentValue = result === 'Error' ? 'Error' : result.toString();
    updateCalcDisplay();
    calculatorState.previousValue = null;
    calculatorState.operation = null;
    calculatorState.secondValue = '';
    calculatorState.shouldResetDisplay = true;
}

function clearCalculator() {
    calculatorState.currentValue = '0';
    calculatorState.previousValue = null;
    calculatorState.operation = null;
    calculatorState.secondValue = '';
    calculatorState.shouldResetDisplay = false;
    updateCalcDisplay();
}

function backspaceCalculator() {
    // If we're building the second operand, remove from it
    if (calculatorState.operation !== null && calculatorState.secondValue.length > 0) {
        calculatorState.secondValue = calculatorState.secondValue.slice(0, -1);
        calculatorState.currentValue = calculatorState.currentValue.slice(0, -1);
    } else if (calculatorState.currentValue.length > 1) {
        calculatorState.currentValue = calculatorState.currentValue.slice(0, -1);
    } else {
        calculatorState.currentValue = '0';
    }
    updateCalcDisplay();
}

function handleCalculatorButton(calcAction) {
    if (!calcAction) return;
    
    if (calcAction >= '0' && calcAction <= '9') {
        handleCalcNumber(calcAction);
    } else if (calcAction === '.') {
        // Check if the current number being entered already has a decimal
        const currentNumber = calculatorState.operation !== null ? calculatorState.secondValue : calculatorState.currentValue;
        if (!currentNumber.includes('.')) {
            if (calculatorState.operation !== null) {
                calculatorState.secondValue += '.';
            }
            calculatorState.currentValue += '.';
            updateCalcDisplay();
        }
    } else if (calcAction === 'clear') {
        clearCalculator();
    } else if (calcAction === 'backspace') {
        backspaceCalculator();
    } else if (calcAction === '=') {
        calculateResult();
    } else if (['+', '-', '*', '/'].includes(calcAction)) {
        handleCalcOperator(calcAction);
    }
}

function renderSentMessages() {
    const container = simContent.querySelector('.mock-page');
    if (!container) return;
    
    // Update heading to show count if there are user messages
    if (userSentMessages.length > 0) {
        const heading = container.querySelector('h3');
        if (heading && heading.textContent.includes('Sent Messages')) {
            const totalCount = userSentMessages.length + 3; // 3 mock messages
            heading.textContent = `Sent Messages (${totalCount} total, ${userSentMessages.length} new)`;
        }
    }
    
    // Find the grid container for sent messages
    const gridContainer = container.querySelector('div[style*="display: grid"]');
    if (!gridContainer || userSentMessages.length === 0) return;
    
    // Create HTML for user sent messages
    const userMessagesHTML = userSentMessages.map((msg) => `
        <div class="mock-card" style="padding: 1rem; cursor: pointer;" data-action="view-sent" data-msg-id="${msg.id}">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <h5 style="margin: 0; font-size: 1rem; font-weight: 700;">${escapeHtml(msg.subject)}</h5>
                <span style="font-size: 0.8rem; color: var(--text-muted);">${msg.timestamp}</span>
            </div>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">to: ${escapeHtml(msg.to)}</p>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0.5rem 0 0 0;">${escapeHtml(msg.message.substring(0, 80))}${msg.message.length > 80 ? '...' : ''}</p>
        </div>
    `).join('');
    
    // Prepend user messages to the grid
    gridContainer.insertAdjacentHTML('afterbegin', userMessagesHTML);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderCartItems() {
    const container = document.getElementById('cart-items-container');
    const totalEl = document.getElementById('cart-total');
    if (!container) return;

    if (cartItems.length === 0) {
        container.innerHTML = `
            <div class="mock-card" style="width: 100%; padding: 3rem; text-align: center;">
                <h4 style="color: var(--text-muted); margin-bottom: 1rem;">Your cart is empty</h4>
                <p style="color: var(--text-muted);">Add items from the shop to get started.</p>
            </div>
        `;
        if (totalEl) totalEl.textContent = '$0.00';
        return;
    }

    let total = 0;
    container.innerHTML = cartItems.map((item, index) => {
        const itemTotal = parseFloat(item.price) * item.quantity;
        total += itemTotal;
        return `
            <div class="mock-card" style="width: 100%; margin-bottom: 1rem; padding: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <h4 style="margin-bottom: 0.5rem;">${item.product}</h4>
                    <p style="color: var(--text-muted); margin: 0;">$${item.price} × ${item.quantity}</p>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span style="font-size: 1.2rem; font-weight: 600; color: var(--primary);">$${itemTotal.toFixed(2)}</span>
                    <button class="mock-link" style="padding: 0.5rem 1rem; background: rgba(220, 38, 38, 0.2); color: #ef4444; border: 1px solid #ef4444; border-radius: 6px; cursor: pointer;" data-action="remove" data-index="${index}">
                        Remove
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    // Add event listeners for remove buttons
    container.querySelectorAll('[data-action="remove"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'));
            cartItems.splice(index, 1);
            renderCartItems();
            updateCartCount();
            showRipple();
        });
    });
}

function navigateSim(pageKey, addToHistory = true) {
    const page = SIM_PAGES[pageKey];
    if (!page) return;

    if (addToHistory && currentSimPage !== pageKey) {
        simHistory.push(currentSimPage);
    }
    currentSimPage = pageKey;

    simContent.innerHTML = page.content;
    simUrl.textContent = page.url;

    // Special handling for cart page
    if (pageKey === 'cart') {
        setTimeout(renderCartItems, 0);
    }
    
    // Special handling for sent mail page
    if (pageKey === 'mail-sent') {
        setTimeout(renderSentMessages, 0);
    }
    
    // Special handling for compose page - focus first input
    if (pageKey === 'compose-mail') {
        setTimeout(() => {
            const toInput = document.getElementById('compose-to');
            if (toInput) toInput.focus();
        }, 100);
    }
    
    // Special handling for calculator page
    if (pageKey === 'calculator') {
        setTimeout(initCalculator, 0);
    }

    // Initialize toggle positions after page load
    if (pageKey === 'theme-customization' || pageKey === 'privacy-controls') {
        setTimeout(() => {
            // Initialize toggle switches
            document.querySelectorAll('[data-action*="toggle"]').forEach(toggle => {
                const toggleButton = toggle.querySelector('div');
                if (toggleButton && !toggleButton.style.left) {
                    // Default positions
                    if (toggle.getAttribute('data-action') === 'toggle-analytics' ||
                        toggle.getAttribute('data-action') === 'toggle-crash') {
                        toggleButton.style.left = '26px'; // On position
                    } else {
                        toggleButton.style.left = '2px'; // Off position
                    }
                }
            });
        }, 0);
    }

    updateCartCount();
    
    // Re-highlight element at current mouse position after content change
    setTimeout(() => {
        highlightElementAtMousePosition();
        attachTextModeListeners();
    }, 0);
}

function navigateBackSim() {
    if (simHistory.length > 0) {
        const prevPage = simHistory.pop();
        navigateSim(prevPage, false);
    }
}

function handleAction(element) {
    if (!element) return;
    
    // If the element doesn't have a target or action, check parent elements
    let target = element.getAttribute('data-target');
    let action = element.getAttribute('data-action');
    
    // If no target/action found, look for closest parent with them
    if (!target && !action) {
        const parentWithTarget = element.closest('[data-target], [data-action]');
        if (parentWithTarget) {
            target = parentWithTarget.getAttribute('data-target');
            action = parentWithTarget.getAttribute('data-action');
            element = parentWithTarget; // Use the parent for subsequent attribute checks
        }
    }
    
    if (target) {
        navigateSim(target);
        showRipple();
    } else if (action === 'buy') {
        const product = element.getAttribute('data-product');
        const price = element.getAttribute('data-price');
        
        if (product && price) {
            // Check if item already exists in cart
            const existingItem = cartItems.find(item => item.product === product);
            if (existingItem) {
                existingItem.quantity++;
            } else {
                cartItems.push({
                    product: product,
                    price: price,
                    quantity: 1
                });
            }
            
            updateCartCount();
            const countEl = document.getElementById('cart-count');
            if (countEl) {
                countEl.style.transform = 'scale(1.5)';
                countEl.style.color = '#fff';
                setTimeout(() => {
                    countEl.style.transform = 'scale(1)';
                    countEl.style.color = 'var(--accent)';
                }, 200);
            }
        }
        showRipple();
    } else if (action === 'checkout') {
        if (cartItems.length > 0) {
            showFlashMessage('Order placed successfully! Your items will be shipped soon.', 'success');
            cartItems = [];
            updateCartCount();
            navigateSim('shop');
        }
        showRipple();
    } else if (action === 'toggle-analytics') {
        const toggle = element.querySelector('div');
        if (toggle) {
            const isOn = toggle.style.left === '26px';
            if (isOn) {
                toggle.style.left = '2px';
                element.style.background = '#64748b';
                showFlashMessage('Usage analytics disabled', 'warning');
            } else {
                toggle.style.left = '26px';
                element.style.background = '#22c55e';
                showFlashMessage('Usage analytics enabled', 'success');
            }
        }
        showRipple();
    } else if (action === 'toggle-crash') {
        const toggle = element.querySelector('div');
        if (toggle) {
            const isOn = toggle.style.left === '26px';
            if (isOn) {
                toggle.style.left = '2px';
                element.style.background = '#64748b';
                showFlashMessage('Crash reporting disabled', 'warning');
            } else {
                toggle.style.left = '26px';
                element.style.background = '#ef4444';
                showFlashMessage('Crash reporting enabled', 'success');
            }
        }
        showRipple();
    } else if (action === 'export-data') {
        showFlashMessage('Data export prepared! Check your downloads folder.', 'success');
        showRipple();
    } else if (action === 'clear-data') {
        showModal(
            'Clear All Data',
            'Are you sure you want to clear all your data? This action cannot be undone and will reset all settings to their defaults.',
            (confirmed) => {
                if (confirmed) {
                    showFlashMessage('All data cleared and settings reset to defaults', 'success');
                    // Reset toggles to default state
                    const analyticsToggle = document.querySelector('[data-action="toggle-analytics"] div');
                    const crashToggle = document.querySelector('[data-action="toggle-crash"] div');
                    if (analyticsToggle) {
                        analyticsToggle.style.left = '26px';
                        analyticsToggle.parentElement.style.background = '#22c55e';
                    }
                    if (crashToggle) {
                        crashToggle.style.left = '26px';
                        crashToggle.parentElement.style.background = '#ef4444';
                    }
                }
            },
            'Clear Data',
            'Cancel'
        );
        showRipple();
    } else if (action === 'set-theme') {
        const theme = element.getAttribute('data-theme');
        // Remove border from all theme cards
        document.querySelectorAll('[data-action="set-theme"]').forEach(card => {
            card.style.border = '1px solid rgba(71, 85, 105, 0.3)';
        });
        // Add border to selected theme
        element.style.border = '2px solid var(--primary)';
        showFlashMessage(`Theme changed to ${theme.charAt(0).toUpperCase() + theme.slice(1)} Mode`, 'success');
        showRipple();
    } else if (action === 'toggle-contrast') {
        const toggle = element.querySelector('div');
        if (toggle) {
            const isOn = toggle.style.left === '26px';
            if (isOn) {
                toggle.style.left = '2px';
                element.style.background = 'var(--surface-light)';
                showFlashMessage('High contrast mode disabled', 'warning');
            } else {
                toggle.style.left = '26px';
                element.style.background = 'var(--primary)';
                showFlashMessage('High contrast mode enabled', 'success');
            }
        }
        showRipple();
    } else if (action === 'toggle-motion') {
        const toggle = element.querySelector('div');
        if (toggle) {
            const isOn = toggle.style.left === '26px';
            if (isOn) {
                toggle.style.left = '2px';
                element.style.background = 'var(--surface-light)';
                showFlashMessage('Reduced motion enabled', 'success');
            } else {
                toggle.style.left = '26px';
                element.style.background = 'var(--primary)';
                showFlashMessage('Reduced motion disabled', 'warning');
            }
        }
        showRipple();
    } else if (action === 'compose') {
        navigateSim('compose-mail');
        showRipple();
    } else if (action === 'send-composed-mail') {
        const toInput = document.getElementById('compose-to');
        const subjectInput = document.getElementById('compose-subject');
        const messageInput = document.getElementById('compose-message');
        
        if (!toInput || !subjectInput || !messageInput) return;
        
        const to = toInput.value.trim();
        const subject = subjectInput.value.trim();
        const message = messageInput.value.trim();
        
        if (!to || !subject || !message) {
            showFlashMessage('Please fill in all fields before sending', 'warning');
            showRipple();
            return;
        }
        
        // Create timestamp
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        
        // Add to sent messages
        userSentMessages.unshift({
            to: to,
            subject: subject,
            message: message,
            timestamp: `Today at ${timeStr}`,
            id: Date.now()
        });
        
        showFlashMessage('Message sent successfully!', 'success');
        setTimeout(() => navigateSim('mail-sent'), 1000);
        showRipple();
    } else if (action === 'refresh') {
        // Add a loading effect
        element.innerHTML = '🔄 Refreshing...';
        element.style.opacity = '0.7';
        setTimeout(() => {
            element.innerHTML = '🔄 Refresh';
            element.style.opacity = '1';
            showFlashMessage('Inbox refreshed - 3 new messages received', 'success');
        }, 1000);
        showRipple();
    } else if (action === 'modal-confirm') {
        if (modalCallback) modalCallback(true);
        hideModal();
        showRipple();
    } else if (action === 'modal-cancel') {
        if (modalCallback) modalCallback(false);
        hideModal();
        showRipple();
    } else if (action === 'reply') {
        showFlashMessage('Reply composer opened', 'success');
        showRipple();
    } else if (action === 'forward') {
        showFlashMessage('Forward composer opened', 'success');
        showRipple();
    } else if (action === 'delete-mail') {
        showModal(
            'Delete Message',
            'Are you sure you want to move this message to trash?',
            (confirmed) => {
                if (confirmed) {
                    showFlashMessage('Message moved to trash', 'success');
                    setTimeout(() => navigateSim('mail-inbox'), 500);
                }
            },
            'Delete',
            'Cancel'
        );
        showRipple();
    } else if (action === 'send-draft') {
        showFlashMessage('Draft sent successfully!', 'success');
        setTimeout(() => navigateSim('mail-sent'), 1000);
        showRipple();
    } else if (action === 'save-draft') {
        showFlashMessage('Draft saved', 'success');
        showRipple();
    } else if (action === 'discard-draft') {
        showModal(
            'Discard Draft',
            'Are you sure you want to discard this draft? This action cannot be undone.',
            (confirmed) => {
                if (confirmed) {
                    showFlashMessage('Draft discarded', 'warning');
                    setTimeout(() => navigateSim('mail-drafts'), 500);
                }
            },
            'Discard',
            'Cancel'
        );
        showRipple();
    } else if (action === 'restore') {
        showFlashMessage('Message restored to inbox', 'success');
        showRipple();
    } else if (action === 'empty-trash') {
        showModal(
            'Empty Trash',
            'Are you sure you want to permanently delete all messages in trash? This action cannot be undone.',
            (confirmed) => {
                if (confirmed) {
                    showFlashMessage('Trash emptied successfully', 'success');
                    // Update the trash view to show empty state
                    setTimeout(() => navigateSim('mail-trash'), 500);
                }
            },
            'Empty Trash',
            'Cancel'
        );
        showRipple();
    } else if (action === 'view-sent') {
        const msgId = parseInt(element.getAttribute('data-msg-id'));
        const message = userSentMessages.find(msg => msg.id === msgId);
        if (message) {
            // Create a dynamic page for this message
            SIM_PAGES['user-sent-' + msgId] = {
                url: 'https://keypilot.io/apps/mail/sent/' + msgId,
                content: `
                    <div class="mock-page">
                        <div class="mock-nav">
                            <a href="#" class="mock-link" data-target="mail-sent">← Back to Sent</a>
                        </div>
                        <div class="mock-card" style="width: 100%; padding: 2rem; margin-top: 1rem;">
                            <h2 style="margin-bottom: 1.5rem; color: var(--text);">${escapeHtml(message.subject)}</h2>
                            <div style="display: grid; gap: 0.75rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); margin-bottom: 1.5rem;">
                                <div style="display: flex; gap: 0.5rem;">
                                    <strong style="min-width: 80px; color: var(--text-muted);">From:</strong>
                                    <span>you@example.com</span>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    <strong style="min-width: 80px; color: var(--text-muted);">To:</strong>
                                    <span style="color: var(--primary);">${escapeHtml(message.to)}</span>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    <strong style="min-width: 80px; color: var(--text-muted);">Date:</strong>
                                    <span style="color: var(--text-muted);">${message.timestamp}</span>
                                </div>
                            </div>
                            <div style="line-height: 1.8; color: var(--text-secondary); white-space: pre-wrap;">
                                ${escapeHtml(message.message)}
                            </div>
                        </div>
                    </div>
                `
            };
            navigateSim('user-sent-' + msgId);
        }
        showRipple();
    } else if (action === 'calc-btn') {
        const calcAction = element.getAttribute('data-calc');
        handleCalculatorButton(calcAction);
        showRipple();
    }
}

// Add click support for simulation
simContainer.addEventListener('click', (e) => {
    const interactive = e.target.closest('.mock-link, .mock-card, .sim-modal-btn, .calc-btn');
    if (interactive) {
        handleAction(interactive);
    }
});

// Initialize simulation
navigateSim('explore', false);

// Track mouse position globally
window.mouseX = 0;
window.mouseY = 0;

// Function to highlight element at current mouse position
function highlightElementAtMousePosition() {
    const rect = simContainer.getBoundingClientRect();
    const isInContainer = (
        window.mouseX >= rect.left &&
        window.mouseX <= rect.right &&
        window.mouseY >= rect.top &&
        window.mouseY <= rect.bottom
    );

    if (isInContainer) {
        // Highlight elements under cursor
        const elements = document.elementsFromPoint(window.mouseX, window.mouseY);
        const interactive = elements.find(el =>
            el.classList.contains('mock-link') ||
            el.classList.contains('mock-card') ||
            el.classList.contains('sim-modal-btn') ||
            el.classList.contains('calc-btn')
        );

        document.querySelectorAll('.mock-link, .mock-card, .sim-modal-btn').forEach(el => {
            el.classList.remove('active-element');
        });

        if (interactive) {
            interactive.classList.add('active-element');
        }
    }
}

// Highlight elements under cursor on mouse move
document.addEventListener('mousemove', (e) => {
    window.mouseX = e.clientX;
    window.mouseY = e.clientY;
    highlightElementAtMousePosition();
});

// Keyboard simulation
document.addEventListener('keydown', (e) => {
    const rect = simContainer.getBoundingClientRect();
    // Only capture if mouse is inside simulation (optional, but better for multi-section pages)
    const isInContainer = (
        window.mouseX >= rect.left &&
        window.mouseX <= rect.right &&
        window.mouseY >= rect.top &&
        window.mouseY <= rect.bottom
    );
    if (!isInContainer && !isSearching && !isTextMode) return;

    const key = e.key.toLowerCase();

    // Handle text mode
    if (isTextMode) {
        if (e.key === 'Escape') {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                activeElement.blur();
                exitTextMode();
            }
        }
        return;
    }

    if (isSearching) {
        if (e.key === 'Escape') {
            isSearching = false;
            simSearch.style.display = 'none';
            simSearchInput.blur();
        }
        return;
    }

    if (key === 'f') {
        const active = document.querySelector('.active-element');
        if (active && active.closest('.simulation-container')) {
            handleAction(active);
        }
    } else if (key === 'd' || key === 's') {
        navigateBackSim();
        showRipple();
    } else if (key === '`') {
        navigateSim('explore');
        showRipple();
    } else if (key === '/') {
        e.preventDefault();
        isSearching = true;
        simSearch.style.display = 'block';
        simSearchInput.focus();
        showRipple();
    }
});

function showRipple() {
    // Small ripple effect simulation
    const ripple = document.createElement('div');
    ripple.style.position = 'fixed';
    ripple.style.left = window.mouseX + 'px';
    ripple.style.top = window.mouseY + 'px';
    ripple.style.width = '20px';
    ripple.style.height = '20px';
    ripple.style.background = 'rgba(0,128,0,0.4)';
    ripple.style.borderRadius = '50%';
    ripple.style.transform = 'translate(-50%, -50%)';
    ripple.style.pointerEvents = 'none';
    ripple.style.zIndex = '9998';
    ripple.style.transition = 'all 0.4s ease-out';
    document.body.appendChild(ripple);
    
    setTimeout(() => {
        ripple.style.width = '100px';
        ripple.style.height = '100px';
        ripple.style.opacity = '0';
    }, 10);
    
    setTimeout(() => ripple.remove(), 500);
}
});
