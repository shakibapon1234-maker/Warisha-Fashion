/* ============================================================ ENTRY POINT
   এই ফাইলটাই index.html থেকে <script type="module"> দিয়ে লোড হয়।
   প্রতিটা ফিচার তার নিজের js/*.js ফাইলে থাকে; onclick হ্যান্ডলারের জন্য
   দরকারি ফাংশনগুলো সংশ্লিষ্ট ফাইলের নিচেই window-এ অ্যাসাইন করা আছে।
   ========================================================== */
import { initModal } from './modal.js';
import './payment-accounts.js';
import './catalog.js';
import './purchases.js';
import './sales.js';
import './ledger.js';
import './capital.js';
import './expenses.js';
import './reports.js';
import './export.js';
import './backup-sync.js';
import './settings.js';
import './tabs.js';
import { initAuth } from './auth.js';

initModal();
initAuth();
