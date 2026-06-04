"""
Invoice HTML to Image Converter using Playwright
ইনভয়েস HTML কে Playwright দিয়ে image এ convert করে
"""

import os
import io
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class InvoiceImageGenerator:
    """Playwright দিয়ে HTML invoice কে image (PNG/JPG) এ convert করে"""
    
    def __init__(self):
        self.browser = None
        self.context = None
    
    async def initialize_browser(self):
        """Browser initialize করে"""
        try:
            from playwright.async_api import async_playwright
            
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(headless=True)
            self.context = await self.browser.new_context(
                viewport={'width': 800, 'height': 1100}  # A4 size
            )
        except Exception as e:
            logger.error(f"❌ Browser initialization failed: {e}")
            raise
    
    async def close_browser(self):
        """Browser close করে"""
        try:
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
        except Exception as e:
            logger.error(f"Browser close error: {e}")
    
    async def html_to_image(self, html_content: str, image_format: str = 'png') -> bytes:
        """
        HTML কে image bytes এ convert করে
        
        Args:
            html_content: Invoice HTML content
            image_format: 'png' or 'jpeg'
        
        Returns:
            Image bytes
        """
        if not self.browser:
            await self.initialize_browser()
        
        try:
            page = await self.context.new_page()
            
            # HTML content সেট করে
            await page.set_content(html_content, wait_until='networkidle')
            
            # Wait for images to load
            try:
                await page.wait_for_load_state('networkidle', timeout=5000)
            except:
                logger.warning("Some resources didn't load, continuing anyway")
            
            # Screenshot নেয় (Playwright Python uses `type=` not `format=`)
            # Accept both 'jpeg' and 'jpg' inputs
            img_type = 'jpeg' if image_format.lower() in ('jpg', 'jpeg') else 'png'
            screenshot_bytes = await page.screenshot(type=img_type)
            
            await page.close()
            
            logger.info(f"✅ Invoice image generated successfully ({len(screenshot_bytes)} bytes)")
            return screenshot_bytes
            
        except Exception as e:
            logger.error(f"❌ HTML to image conversion failed: {e}")
            raise
    
    @staticmethod
    def generate_invoice_html(order_data: dict, shop_name: str = "Smart Shop BD") -> str:
        """
        Order data থেকে professional invoice HTML তৈরি করে
        
        Args:
            order_data: CustomerOrder dictionary
            shop_name: Shop/Business name
        
        Returns:
            HTML string
        """
        
        # Format values
        order_id = order_data.get('id', 'N/A')
        customer_name = order_data.get('customer_name', 'Unknown')
        phone = order_data.get('phone_number', 'N/A')
        address = order_data.get('address', 'N/A')
        district = order_data.get('district', '')
        upazila = order_data.get('upazila', '')
        product_name = order_data.get('product_name', 'Product')
        price = order_data.get('price', 0)
        status = order_data.get('status', 'pending').upper()
        created_at = order_data.get('created_at', datetime.now().isoformat())
        
        # Date formatting
        try:
            date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            formatted_date = date_obj.strftime('%d %b, %Y')
        except:
            formatted_date = created_at.split('T')[0] if 'T' in created_at else created_at
        
        # Status badge color
        status_color_map = {
            'PENDING': '#fbbf24',
            'SHIPPED': '#6366f1',
            'DELIVERED': '#10b981'
        }
        status_color = status_color_map.get(status, '#6b7280')

        # Generate table rows
        items = order_data.get('items')
        table_rows = ""
        total_price = 0
        
        if items and isinstance(items, list) and len(items) > 0:
            for idx, item in enumerate(items, 1):
                name = item.get('name', 'Product')
                qty = item.get('quantity', 1)
                item_price = float(item.get('price', 0))
                line_total = item_price * qty
                total_price += line_total
                
                table_rows += f"""
                        <tr>
                            <td>{idx}</td>
                            <td>
                                <div class="item-name">{name} (x{qty})</div>
                                <div class="item-description">Product order from {shop_name}</div>
                            </td>
                            <td style="text-align: right; font-weight: 600;">৳ {item_price:,.2f}</td>
                            <td style="text-align: center;">
                                <span class="status-badge">{status}</span>
                            </td>
                            <td style="text-align: right; font-weight: 700; color: #111827;">৳ {line_total:,.2f}</td>
                        </tr>"""
        else:
            # Fallback
            total_price = float(order_data.get('price', 0))
            qty = int(order_data.get('item_quantity', 1))
            
            table_rows = f"""
                        <tr>
                            <td>1</td>
                            <td>
                                <div class="item-name">{product_name} (x{qty})</div>
                                <div class="item-description">Product order from {shop_name}</div>
                            </td>
                            <td style="text-align: right; font-weight: 600;">৳ {(total_price/qty if qty > 0 else total_price):,.2f}</td>
                            <td style="text-align: center;">
                                <span class="status-badge">{status}</span>
                            </td>
                            <td style="text-align: right; font-weight: 700; color: #111827;">৳ {total_price:,.2f}</td>
                        </tr>"""
        
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice #{order_id}</title>
            <style>
                * {{
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }}
                
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: #f3f4f6;
                    padding: 20px;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }}
                
                .invoice-page {{
                    background: white;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 40px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                    border-radius: 8px;
                }}
                
                .invoice-header {{
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 3px solid #e5e7eb;
                    padding-bottom: 30px;
                    margin-bottom: 40px;
                }}
                
                .company-info h1 {{
                    font-size: 32px;
                    font-weight: 800;
                    color: #111827;
                    margin-bottom: 5px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }}
                
                .company-info p {{
                    color: #6b7280;
                    font-size: 14px;
                }}
                
                .invoice-title-block {{
                    text-align: right;
                }}
                
                .invoice-title {{
                    font-size: 48px;
                    font-weight: 800;
                    color: #3b82f6;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-bottom: 10px;
                }}
                
                .invoice-meta {{
                    font-size: 13px;
                    color: #4b5563;
                    line-height: 1.8;
                }}
                
                .invoice-meta strong {{
                    color: #111827;
                }}
                
                .billing-section {{
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                    margin-bottom: 40px;
                }}
                
                .bill-to {{
                    background: #f9fafb;
                    padding: 25px;
                    border-radius: 8px;
                    border-left: 4px solid #3b82f6;
                }}
                
                .bill-to h3 {{
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #6b7280;
                    margin-bottom: 12px;
                    letter-spacing: 1px;
                    font-weight: 700;
                }}
                
                .customer-details h4 {{
                    font-size: 18px;
                    color: #111827;
                    margin-bottom: 8px;
                    font-weight: 600;
                }}
                
                .customer-details p {{
                    font-size: 14px;
                    color: #4b5563;
                    line-height: 1.8;
                    margin-bottom: 4px;
                }}
                
                .payment-info {{
                    background: #f3f4f6;
                    padding: 25px;
                    border-radius: 8px;
                }}
                
                .payment-info h3 {{
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #6b7280;
                    margin-bottom: 12px;
                    letter-spacing: 1px;
                    font-weight: 700;
                }}
                
                .payment-line {{
                    display: flex;
                    justify-content: space-between;
                    font-size: 13px;
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #e5e7eb;
                }}
                
                .payment-line span:first-child {{
                    color: #6b7280;
                }}
                
                .payment-line strong {{
                    color: #111827;
                    font-weight: 600;
                }}
                
                .items-table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 40px;
                }}
                
                .items-table th {{
                    background: #3b82f6;
                    color: white;
                    padding: 15px;
                    text-align: left;
                    font-size: 12px;
                    text-transform: uppercase;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }}
                
                .items-table td {{
                    padding: 15px;
                    border-bottom: 1px solid #e5e7eb;
                    font-size: 14px;
                    color: #374151;
                }}
                
                .item-name {{
                    font-weight: 600;
                    color: #111827;
                    margin-bottom: 4px;
                }}
                
                .item-description {{
                    font-size: 12px;
                    color: #6b7280;
                }}
                
                .status-badge {{
                    display: inline-block;
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    background: {status_color};
                    color: white;
                }}
                
                .totals-section {{
                    display: flex;
                    justify-content: flex-end;
                    margin-bottom: 40px;
                }}
                
                .totals {{
                    width: 320px;
                    border-top: 2px solid #e5e7eb;
                    padding-top: 20px;
                }}
                
                .total-line {{
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 12px;
                    font-size: 14px;
                }}
                
                .total-line span:first-child {{
                    color: #6b7280;
                }}
                
                .total-line strong {{
                    color: #111827;
                    font-weight: 600;
                }}
                
                .total-final {{
                    display: flex;
                    justify-content: space-between;
                    margin-top: 15px;
                    padding-top: 15px;
                    border-top: 2px dashed #e5e7eb;
                    font-size: 18px;
                    font-weight: 800;
                }}
                
                .total-final span:first-child {{
                    color: #111827;
                }}
                
                .total-final span:last-child {{
                    color: #3b82f6;
                }}
                
                .invoice-footer {{
                    border-top: 2px solid #e5e7eb;
                    padding-top: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                }}
                
                .footer-thanks {{
                    font-weight: 700;
                    color: #111827;
                    font-size: 14px;
                }}
                
                .footer-contact {{
                    text-align: right;
                    color: #6b7280;
                    line-height: 1.6;
                }}
                
                @media print {{
                    body {{
                        background: white;
                        padding: 0;
                    }}
                    .invoice-page {{
                        margin: 0;
                        box-shadow: none;
                        border-radius: 0;
                    }}
                }}
            </style>
        </head>
        <body>
            <div class="invoice-page">
                <div class="invoice-header">
                    <div class="company-info">
                        <h1>{shop_name}</h1>
                        <p>Your Trusted Shopping Partner</p>
                    </div>
                    <div class="invoice-title-block">
                        <div class="invoice-title">INVOICE</div>
                        <div class="invoice-meta">
                            <p>Invoice No: <strong>#{order_id}</strong></p>
                            <p>Date: <strong>{formatted_date}</strong></p>
                        </div>
                    </div>
                </div>
                
                <div class="billing-section">
                    <div class="bill-to">
                        <h3>Billed To</h3>
                        <div class="customer-details">
                            <h4>{customer_name}</h4>
                            <p>{phone}</p>
                            <p>{address}</p>
                            <p>{upazila + ", " if upazila else ""}{district}</p>
                        </div>
                    </div>
                    
                    <div class="payment-info">
                        <h3>Order Details</h3>
                        <div class="payment-line">
                            <span>Payment Method</span>
                            <strong>Cash on Delivery</strong>
                        </div>
                        <div class="payment-line">
                            <span>Delivery Type</span>
                            <strong>Home Delivery</strong>
                        </div>
                        <div class="payment-line" style="border-bottom: none;">
                            <span>Order Status</span>
                            <strong>{status}</strong>
                        </div>
                    </div>
                </div>
                
                <table class="items-table">
                    <thead>
                        <tr>
                            <th style="width: 5%;">#</th>
                            <th style="width: 50%;">Item Description</th>
                            <th style="width: 15%; text-align: right;">Price</th>
                            <th style="width: 15%; text-align: center;">Status</th>
                            <th style="width: 15%; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
{table_rows}
                    </tbody>
                </table>
                
                <div class="totals-section">
                    <div class="totals">
                        <div class="total-line">
                            <span>Subtotal:</span>
                            <strong>৳ {total_price:,.2f}</strong>
                        </div>
                        <div class="total-line">
                            <span>Shipping:</span>
                            <strong>৳ 0.00</strong>
                        </div>
                        <div class="total-line">
                            <span>Tax:</span>
                            <strong>৳ 0.00</strong>
                        </div>
                        <div class="total-final">
                            <span>TOTAL:</span>
                            <span>৳ {total_price:,.2f}</span>
                        </div>
                    </div>
                </div>
                
                <div class="invoice-footer">
                    <div class="footer-thanks">
                        Thank you for your business!
                    </div>
                    <div class="footer-contact">
                        support@{shop_name.lower().replace(' ', '')}.com<br/>
                        www.{shop_name.lower().replace(' ', '')}.com
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html
