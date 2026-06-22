(function() {
    'use strict';

    const selectors = {
        button: '.wp-block-slidey-panel-panel.slidey-panel-mode[data-slidey-panel-content-id] a',
        wrapper: '.wp-block-slidey-panel-panel',
        panel: '.slidey-panel-panel',
        cover: '.slidey-panel-cover',
        close: '.slidey-panel-close'
    };

    let activePanel = null;
    let lastTrigger = null;
    let currentScroll = 0;
    const openedPanels = new WeakSet();

    const labels = window.slideyPanelFrontend || {};

    const getPanel = function(contentId) {
        return document.querySelector(`${selectors.panel}[data-slidey-panel-id="${contentId}"]`);
    };

    const getCover = function() {
        return document.querySelector(selectors.cover);
    };

    const panelBoolean = function(panel, name, defaultValue) {
        if (!panel || !panel.dataset || 'undefined' === typeof panel.dataset[name]) {
            return defaultValue;
        }

        return 'false' !== panel.dataset[name];
    };

    const getSpecifiedTextColor = function(panel) {
        const content = panel.querySelector('.slidey-panel-content');
        const colorElements = content ? content.querySelectorAll('.has-text-color, [style*="color"]') : [];

        for (const element of colorElements) {
            if (!element.classList.contains('has-text-color') && !element.style.color) {
                continue;
            }

            const color = window.getComputedStyle(element).color;

            if (color && 'rgba(0, 0, 0, 0)' !== color && 'transparent' !== color) {
                return color;
            }
        }

        return labels.closeColor || '#000000';
    };

    const preparePanelCloseColor = function(panel) {
        const closeButton = panel.querySelector(selectors.close);

        if (closeButton) {
            closeButton.style.color = getSpecifiedTextColor(panel);
        }
    };

    const preparePanelScrollContainer = function(panel) {
        const content = panel.querySelector('.slidey-panel-content');
        const container = content ? content.firstElementChild : null;
        const minHeight = container && container.style ? container.style.minHeight : '';

        if (
            !container ||
            !container.classList.contains('wp-block-group')
        ) {
            return;
        }

        container.style.setProperty('--slidey-panel-content-height', minHeight || '100%');
        container.classList.add('slidey-panel-scroll-container');
        content.classList.add('has-scroll-container');
        panel.classList.add('has-content-scroll-container');
    };

    const triggerCanReceiveFocus = function(trigger) {
        if (!trigger || trigger.closest('[hidden]')) {
            return false;
        }

        const style = window.getComputedStyle(trigger);

        return 'none' !== style.display && 'hidden' !== style.visibility;
    };

    const closePanel = function(options) {
        const cover = getCover();
        const closeOptions = Object.assign({ restoreFocus: true }, options || {});

        if (activePanel) {
            activePanel.classList.remove('is-open');
            activePanel.setAttribute('aria-hidden', 'true');
        }

        if (cover) {
            cover.classList.remove('is-open');
        }

        document.body.classList.remove('slidey-panel-is-open');

        if (lastTrigger) {
            lastTrigger.classList.remove('is-open');
            lastTrigger.setAttribute('aria-expanded', 'false');

            if (closeOptions.restoreFocus && triggerCanReceiveFocus(lastTrigger)) {
                try {
                    lastTrigger.focus({ preventScroll: true });
                } catch (error) {
                    lastTrigger.focus();
                }
            }
        }

        activePanel = null;
        lastTrigger = null;
    };

    const openPanel = function(trigger) {
        const wrapper = trigger.closest(selectors.wrapper);
        const contentId = wrapper ? wrapper.dataset.slideyPanelContentId : '';
        const panel = contentId ? getPanel(contentId) : null;
        const cover = getCover();

        if (!panel || !cover) {
            return;
        }

        if (activePanel && activePanel !== panel) {
            closePanel();
        }

        activePanel = panel;
        lastTrigger = trigger;
        currentScroll = window.pageYOffset || document.documentElement.scrollTop || 0;
        openedPanels.add(panel);

        cover.style.setProperty(
            '--slidey-panel-transition-duration',
            window.getComputedStyle(panel).getPropertyValue('--slidey-panel-transition-duration') || '0.2s'
        );
        cover.style.backgroundColor = panel.dataset.slideyPanelCoverColor || 'rgba(0, 0, 0, 0.6)';
        cover.hidden = false;
        cover.classList.add('is-open');
        panel.classList.add('is-open');
        panel.setAttribute('aria-hidden', 'false');
        preparePanelCloseColor(panel);
        trigger.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        document.body.classList.add('slidey-panel-is-open');

        const closeButton = panel.querySelector(selectors.close);

        if (closeButton) {
            closeButton.focus();
        }
    };

    const prepareButtons = function() {
        document.querySelectorAll(selectors.button).forEach(function(button) {
            button.setAttribute('role', 'button');
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-expanded', 'false');

            if (!button.getAttribute('aria-label')) {
                const title = button.getAttribute('title');
                const text = button.textContent.trim();

                button.setAttribute('aria-label', title || text || labels.openLabel || 'Open menu');
            }
        });
    };

    const preparePanels = function() {
        document.querySelectorAll(selectors.panel).forEach(function(panel) {
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');
            preparePanelScrollContainer(panel);
            preparePanelCloseColor(panel);
        });
    };

    const handleDocumentClick = function(event) {
        const trigger = event.target.closest(selectors.button);

        if (trigger) {
            event.preventDefault();

            if (activePanel && lastTrigger === trigger) {
                closePanel();
            } else {
                openPanel(trigger);
            }

            return;
        }

        if (event.target.closest(selectors.close)) {
            event.preventDefault();
            closePanel();

            return;
        }

        if (
            event.target.matches(selectors.cover) &&
            panelBoolean(activePanel, 'slideyPanelCoverClickClose', true)
        ) {
            event.preventDefault();
            closePanel({ restoreFocus: false });
        }
    };

    const handleKeydown = function(event) {
        if ('Escape' === event.key && activePanel) {
            closePanel();
        }
    };

    const handleScroll = function() {
        const activeElement = document.activeElement;
        const activeTag = activeElement && activeElement.tagName ? activeElement.tagName.toUpperCase() : '';
        const nextScroll = window.pageYOffset || document.documentElement.scrollTop || 0;

        if (
            activePanel &&
            'INPUT' !== activeTag &&
            panelBoolean(activePanel, 'slideyPanelScrollClose', true) &&
            Math.abs(nextScroll - currentScroll) > 400
        ) {
            closePanel({ restoreFocus: false });
        }
    };

    const prepareAutoOpenPanels = function() {
        document.querySelectorAll(selectors.panel).forEach(function(panel) {
            const delay = parseInt(panel.dataset.slideyPanelAutoOpenDelay || '0', 10) || 0;
            const panelId = panel.dataset.slideyPanelId;

            if (!panelBoolean(panel, 'slideyPanelAutoOpen', false) || !panelId) {
                return;
            }

            window.setTimeout(function() {
                const trigger = document.querySelector(`.wp-block-slidey-panel-panel.slidey-panel-mode[data-slidey-panel-content-id="${panelId}"] a`);

                if (trigger && !activePanel && !openedPanels.has(panel)) {
                    openPanel(trigger);
                }
            }, delay);
        });
    };

    const init = function() {
        prepareButtons();
        preparePanels();
        prepareAutoOpenPanels();
        document.addEventListener('click', handleDocumentClick);
        document.addEventListener('keydown', handleKeydown);
        window.addEventListener('scroll', handleScroll);
    };

    if ('loading' === document.readyState) {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
