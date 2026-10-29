import LegalLayout from "@/components/LegalLayout";
import { SITE } from "@/lib/site";

export const metadata = {
  title: "Terms of Service",
  description: `Terms for using ${SITE.name}.`,
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" subtitle="ব্যবহারের শর্তাবলি — Shop ব্যবহার করার আগে অনুগ্রহ করে পড়ে নিন।">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of {SITE.name} at{" "}
        <a href={SITE.url}>{SITE.url.replace(/^https?:\/\//, "")}</a>, operated by {SITE.company}, {SITE.country}. By
        signing in or placing an order, you agree to these Terms and to our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>1. What {SITE.name} is</h2>
      <p>
        {SITE.name} is an ordering and order-tracking service. Products are sold by independent businesses
        (&quot;Merchants&quot;) who use the {SITE.company} platform. {SITE.company} provides the technology; the Merchant is
        the seller and is responsible for its products, prices, stock, delivery and after-sales service.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You sign in with your Google account. You must be at least 13 years old.</li>
        <li>You are responsible for activity under your account and for keeping your Google account secure.</li>
        <li>
          Linking your account to a chat (Messenger, WhatsApp, Telegram, etc.) lets the Merchant identify you and send
          you order updates there. You can unlink at any time.
        </li>
      </ul>

      <h2>3. Placing orders</h2>
      <ul>
        <li>You must provide accurate name, phone number and delivery address information.</li>
        <li>
          An order is a request to purchase from the Merchant. The Merchant may confirm, modify (with your consent) or
          cancel an order, for example if an item is out of stock or details cannot be verified.
        </li>
        <li>
          Prices, delivery charges and any cash-on-delivery fees are shown before you confirm. Delivery charges are
          calculated from the courier service and address you select and may change if the address changes.
        </li>
        <li>Delivery times are estimates provided by the Merchant and courier and are not guaranteed.</li>
      </ul>

      <h2>4. Payments, returns and refunds</h2>
      <p>
        Payment methods (such as cash on delivery or mobile financial services) are offered by the Merchant. Returns,
        exchanges and refunds follow the Merchant&apos;s own policy. Please contact the Merchant first for any issue with
        your order; we will help where we reasonably can.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Place fake, fraudulent or repeated orders with no intent to receive them</li>
        <li>Provide someone else&apos;s information without their permission</li>
        <li>Attempt to access other users&apos; data or interfere with the service</li>
        <li>Use the service for any unlawful purpose</li>
      </ul>
      <p>
        To protect Merchants, we may use delivery history associated with a phone number to flag risky orders, and we
        may suspend accounts that abuse the service.
      </p>

      <h2>6. Intellectual property</h2>
      <p>
        The {SITE.name} software, design and branding belong to {SITE.company}. Product names, images and descriptions
        belong to the respective Merchants.
      </p>

      <h2>7. Disclaimers and limitation of liability</h2>
      <p>
        The service is provided &quot;as is&quot;. To the maximum extent permitted by law, {SITE.company} is not liable for
        the products sold by Merchants, for courier delays, or for indirect or consequential losses. Our total liability
        for any claim relating to the service is limited to the amount of fees, if any, you paid to {SITE.company} for
        the service.
      </p>

      <h2>8. Termination</h2>
      <p>
        You can stop using {SITE.name} and request account deletion at any time. We may suspend or terminate access if
        you violate these Terms.
      </p>

      <h2>9. Governing law</h2>
      <p>These Terms are governed by the laws of {SITE.country}.</p>

      <h2>10. Changes</h2>
      <p>
        We may update these Terms. Continued use after changes take effect means you accept the updated Terms.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
      </p>
    </LegalLayout>
  );
}
