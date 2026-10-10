/**
 * Instaflow SEO Suite - Lead Generation Embeddable Widget Generator
 */

import { showToast, escapeHtml } from '../../ui/components.js';

export const widgetFeature = {
  id: 'widget',
  title: 'Lead Widget',
  tier: 1,

  render(container, ctx) {
    let widgetConfig = {
      title: 'Get Your Free Instant SEO & AI Audit',
      subtitle: 'Enter your website URL and we will analyze your search health in seconds.',
      buttonText: 'Analyze My Website',
      primaryColor: '#4f46e5',
      accentColor: '#ec4899',
      includePhone: false,
      consentText: 'I agree to receive the audit report and SEO insights via email.'
    };

    container.innerHTML = `
      <div class="seo-widget-view">
        <div class="seo-card">
          <div class="seo-card-header">
            <div>
              <h2 class="seo-card-title">🧲 Embeddable Lead Generation Audit Widget</h2>
              <p class="seo-card-subtitle">Generate a branded audit capture form to embed on your agency website. Submissions capture qualified leads directly into Instaflow.</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <!-- Configuration Form -->
            <div>
              <div class="seo-form-group">
                <label class="seo-label">Widget Heading</label>
                <input type="text" id="w-title" class="seo-input" value="${escapeHtml(widgetConfig.title)}" />
              </div>

              <div class="seo-form-group">
                <label class="seo-label">Subtitle Description</label>
                <input type="text" id="w-sub" class="seo-input" value="${escapeHtml(widgetConfig.subtitle)}" />
              </div>

              <div class="seo-form-group">
                <label class="seo-label">Submit Button Text</label>
                <input type="text" id="w-btn-text" class="seo-input" value="${escapeHtml(widgetConfig.buttonText)}" />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="seo-form-group">
                  <label class="seo-label">Primary Color</label>
                  <input type="color" id="w-color" class="seo-input" value="${widgetConfig.primaryColor}" style="height: 42px; padding: 2px;" />
                </div>
                <div class="seo-form-group">
                  <label class="seo-label" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem; cursor: pointer;">
                    <input type="checkbox" id="w-phone-opt" />
                    <span>Include Phone Field</span>
                  </label>
                </div>
              </div>

              <div class="seo-form-group">
                <label class="seo-label">Copy Embed Snippet</label>
                <textarea id="w-snippet-code" class="seo-textarea" rows="6" readonly style="font-family: monospace; font-size: 0.75rem;"></textarea>
              </div>
              <button type="button" id="w-btn-copy-code" class="seo-btn seo-btn-primary">📋 Copy Embed Code</button>
            </div>

            <!-- Live Preview -->
            <div>
              <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem;">Interactive Live Preview</h4>
              <div id="w-preview-box" style="background: #ffffff; border: 1px solid var(--seo-border); border-radius: 12px; padding: 2rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); color: #0f172a;">
                <h3 id="prev-w-title" style="font-size: 1.25rem; font-weight: 800; text-align: center; margin-bottom: 0.5rem; color: #0f172a;"></h3>
                <p id="prev-w-sub" style="font-size: 0.85rem; color: #64748b; text-align: center; margin-bottom: 1.5rem;"></p>

                <form id="prev-w-form">
                  <!-- Anti-spam Honeypot field (hidden from real users) -->
                  <div style="display:none !important;" aria-hidden="true">
                    <input type="text" name="_hp_website_title" tabindex="-1" autocomplete="off" />
                  </div>

                  <div style="margin-bottom: 0.75rem;">
                    <input type="text" id="lead-name" placeholder="Your Full Name" required style="width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem;" />
                  </div>
                  <div style="margin-bottom: 0.75rem;">
                    <input type="email" id="lead-email" placeholder="Business Email Address" required style="width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem;" />
                  </div>
                  <div style="margin-bottom: 0.75rem;">
                    <input type="url" id="lead-website" placeholder="Website URL (e.g. https://company.com)" required style="width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem;" />
                  </div>
                  <div id="lead-phone-wrap" style="display: none; margin-bottom: 0.75rem;">
                    <input type="tel" id="lead-phone" placeholder="Phone Number (Optional)" style="width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.85rem;" />
                  </div>

                  <button type="submit" id="prev-w-btn" style="width: 100%; padding: 0.75rem; border: none; border-radius: 6px; color: #ffffff; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: opacity 0.2s;"></button>
                </form>

                <div id="lead-preview-result" style="display: none; margin-top: 1rem; text-align: center; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 1rem; border-radius: 8px;">
                  <div style="font-weight: 700; color: #166534;">🎉 Audit Initialized & Lead Saved!</div>
                  <div style="font-size: 0.8rem; color: #15803d; margin-top: 0.25rem;">Score: 88/100 (Grade B+) • Lead sent to Instaflow CRM.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const titleIn = container.querySelector('#w-title');
    const subIn = container.querySelector('#w-sub');
    const btnIn = container.querySelector('#w-btn-text');
    const colorIn = container.querySelector('#w-color');
    const phoneOpt = container.querySelector('#w-phone-opt');
    const codeArea = container.querySelector('#w-snippet-code');
    const copyBtn = container.querySelector('#w-btn-copy-code');

    const prevTitle = container.querySelector('#prev-w-title');
    const prevSub = container.querySelector('#prev-w-sub');
    const prevBtn = container.querySelector('#prev-w-btn');
    const phoneWrap = container.querySelector('#lead-phone-wrap');
    const prevForm = container.querySelector('#prev-w-form');
    const leadResult = container.querySelector('#lead-preview-result');

    function updateWidget() {
      prevTitle.textContent = titleIn.value;
      prevSub.textContent = subIn.value;
      prevBtn.textContent = btnIn.value;
      prevBtn.style.backgroundColor = colorIn.value;
      phoneWrap.style.display = phoneOpt.checked ? 'block' : 'none';

      const snippet = `<!-- Instaflow SEO Lead Audit Widget -->\n<div id="instaflow-seo-widget" data-theme="${colorIn.value}"></div>\n<script src="https://your-domain.com/seo/widget.js" async></script>`;
      codeArea.value = snippet;
    }

    titleIn.addEventListener('input', updateWidget);
    subIn.addEventListener('input', updateWidget);
    btnIn.addEventListener('input', updateWidget);
    colorIn.addEventListener('input', updateWidget);
    phoneOpt.addEventListener('change', updateWidget);
    updateWidget();

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(codeArea.value);
      showToast('Copied widget snippet!', 'success');
    });

    prevForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = container.querySelector('#lead-name').value;
      const email = container.querySelector('#lead-email').value;
      const website = container.querySelector('#lead-website').value;
      const phone = container.querySelector('#lead-phone').value;

      // Submit lead to CRM adapter
      await ctx.crmAdapter.createLead({
        name,
        email,
        website,
        phone,
        score: 88,
        grade: 'B+',
        topIssues: ['Missing Open Graph image', 'Render-blocking scripts']
      });

      leadResult.style.display = 'block';
      showToast('Test lead submitted & saved into Instaflow CRM!', 'success');
    });
  }
};
