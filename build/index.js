(function(wp) {
    var __ = wp.i18n.__;
    var el = wp.element.createElement;
    var useBlockProps = wp.blockEditor.useBlockProps;
    var BlockControls = wp.blockEditor.BlockControls;
    var InspectorControls = wp.blockEditor.InspectorControls;
    var JustifyToolbar = wp.blockEditor.JustifyToolbar;
    var PanelBody = wp.components.PanelBody;
    var TextControl = wp.components.TextControl;
    var SelectControl = wp.components.SelectControl;
    var Button = wp.components.Button;
    var Spinner = wp.components.Spinner;
    var useEffect = wp.element.useEffect;
    var useState = wp.element.useState;
    var apiFetch = wp.apiFetch;
    var getBorderClassesAndStyles = wp.blockEditor.__experimentalGetBorderClassesAndStyles;
    var getColorClassesAndStyles = wp.blockEditor.__experimentalGetColorClassesAndStyles;
    var getSpacingClassesAndStyles = wp.blockEditor.__experimentalGetSpacingClassesAndStyles;
    var getTypographyClassesAndStyles = wp.blockEditor.getTypographyClassesAndStyles;

    function buttonTitle(attributes) {
        if ('undefined' === typeof attributes.title) {
            return __('Slidey Panel', 'slidey-panel');
        }

        return attributes.title;
    }

    function editorButtonTitle(attributes) {
        if ('' === buttonTitle(attributes) && 'icon' !== (attributes.buttonIcon || 'title')) {
            return __('Slidey Panel', 'slidey-panel');
        }

        return buttonTitle(attributes);
    }

    function classNames() {
        return Array.prototype.slice.call(arguments).filter(Boolean).join(' ');
    }

    function mergeObjects() {
        return Object.assign.apply(Object, [{}].concat(Array.prototype.slice.call(arguments).filter(Boolean)));
    }

    function getButtonSupportProps(attributes) {
        var borderProps = getBorderClassesAndStyles ? getBorderClassesAndStyles(attributes) : {};
        var colorProps = getColorClassesAndStyles ? getColorClassesAndStyles(attributes) : {};
        var spacingProps = getSpacingClassesAndStyles ? getSpacingClassesAndStyles(attributes) : {};
        var typographyProps = getTypographyClassesAndStyles ? getTypographyClassesAndStyles(attributes) : {};

        return {
            className: classNames(
                'slidey-panel-open-button',
                borderProps.className,
                colorProps.className,
                spacingProps.className,
                typographyProps.className
            ),
            style: mergeObjects(
                borderProps.style,
                colorProps.style,
                spacingProps.style,
                typographyProps.style
            )
        };
    }

    function editorButtonPreviewProps(attributes) {
        var props = getButtonSupportProps(attributes);

        props.className = classNames('slidey-panel-editor-button-preview', props.className);

        if ('' === buttonTitle(attributes) && 'icon' !== (attributes.buttonIcon || 'title')) {
            props.style = mergeObjects(props.style, { color: '#757575' });
        }

        return props;
    }

    function menuIcon(attributes) {
        var icon = attributes.menuIcon || 'menu';
        var iconElement;

        if ('menu' === icon) {
            iconElement = el(
                'svg',
                {
                    className: 'slidey-panel-button-icon',
                    xmlns: 'http://www.w3.org/2000/svg',
                    viewBox: '0 0 24 24',
                    width: '1em',
                    height: '1em',
                    'aria-hidden': 'true',
                    focusable: 'false'
                },
                el('path', { d: 'M5 5v1.5h14V5H5zm0 7.8h14v-1.5H5v1.5zM5 19h14v-1.5H5V19z' })
            );
        } else {
            iconElement = el(
                'svg',
                {
                    className: 'slidey-panel-button-icon',
                    xmlns: 'http://www.w3.org/2000/svg',
                    viewBox: '0 0 24 24',
                    width: '1em',
                    height: '1em',
                    'aria-hidden': 'true',
                    focusable: 'false'
                },
                el('rect', { x: '4', y: '7.5', width: '16', height: '1.5' }),
                el('rect', { x: '4', y: '15', width: '16', height: '1.5' })
            );
        }

        return iconElement;
    }

    function buttonContents(attributes) {
        var icon = attributes.buttonIcon || 'title';
        var title = buttonTitle(attributes);
        var contents = [];

        if ('icon' === icon || 'left' === icon) {
            contents.push(menuIcon(attributes));
        }

        if ('icon' !== icon) {
            contents.push(el('span', { className: 'slidey-panel-button-title' }, title));
        }

        if ('right' === icon) {
            contents.push(menuIcon(attributes));
        }

        return contents;
    }

    function buttonLinkProps(attributes) {
        var title = buttonTitle(attributes);
        var linkProps = getButtonSupportProps(attributes);

        linkProps.href = '#';

        if ('icon' === (attributes.buttonIcon || 'title')) {
            linkProps['aria-label'] = title || __('Open menu', 'slidey-panel');
        }

        return linkProps;
    }

    function blockClassName(attributes) {
        var justifyContent = attributes.justifyContent;

        return classNames(
            'slidey-panel-mode',
            ('center' === justifyContent || 'right' === justifyContent)
                ? 'is-content-justification-' + justifyContent
                : ''
        );
    }

    function slideyPanelButtonSave(attributes) {
        return el(
            'div',
            wp.blockEditor.useBlockProps.save({
                className: blockClassName(attributes),
                'data-slidey-panel-mode': 'block'
            }),
            el(
                'a',
                buttonLinkProps(attributes),
                buttonContents(attributes)
            )
        );
    }

    function contentPostById(contentPosts, contentId) {
        var contentIdInt = parseInt(contentId, 10);

        return contentPosts.find(function(contentPost) {
            return parseInt(contentPost.id, 10) === contentIdInt;
        });
    }

    function contentOptions(contentPosts) {
        return [{
            label: __('Choose a page', 'slidey-panel'),
            value: '0'
        }].concat(contentPosts.map(function(contentPost) {
            return {
                label: contentPost.title,
                value: String(contentPost.id)
            };
        }));
    }

    function contentControls(contentState, setContentState) {
        var selectedContent = contentPostById(contentState.contentPosts, contentState.defaultContentId);
        var controls = [];

        if (contentState.isLoading) {
            return [el(Spinner)];
        }

        if (!contentState.canManageDefaultContent) {
            return [
                el('p', null, __('You do not have sufficient permission to choose the content page for the Slidey Panel.', 'slidey-panel'))
            ];
        }

        if (contentState.contentPosts.length && !selectedContent) {
            controls.push(
                el(SelectControl, {
                    label: __('Default Slidey Panel page', 'slidey-panel'),
                    value: String(contentState.defaultContentId || 0),
                    options: contentOptions(contentState.contentPosts),
                    onChange: function(value) {
                        var contentId = parseInt(value, 10) || 0;
                        setContentState(Object.assign({}, contentState, { isSaving: true }));

                        apiFetch({
                            path: '/' + contentState.restNamespace + '/default-content',
                            method: 'POST',
                            data: { contentId: contentId }
                        }).then(function(response) {
                            setContentState(Object.assign({}, contentState, {
                                contentPosts: response.contentPosts,
                                defaultContentId: response.defaultContentId,
                                isSaving: false
                            }));
                        }).catch(function() {
                            setContentState(Object.assign({}, contentState, { isSaving: false }));
                        });
                    },
                    disabled: contentState.isSaving
                })
            );

            if (contentState.isSaving) {
                controls.push(el(Spinner));
            }
        }

        if (!selectedContent && contentState.canCreateContent && contentState.createContentUrl) {
            controls.push(el(Button, {
                href: contentState.createContentUrl,
                variant: contentState.contentPosts.length ? 'secondary' : 'primary'
            }, __('Add Slidey Panel Page', 'slidey-panel')));
        }

        if (selectedContent) {
            if (selectedContent.editLink) {
                controls.push(el(Button, {
                    href: selectedContent.editLink,
                    variant: 'secondary'
                }, __('Edit Slidey Panel Page', 'slidey-panel')));
            } else {
                controls.push(
                    el('p', null, __('You can use this page, but an Editor or Administrator must edit it.', 'slidey-panel'))
                );
            }
        } else if (!contentState.contentPosts.length) {
            if (!contentState.canCreateContent || !contentState.createContentUrl) {
                controls.push(
                    el('p', null, __('An Editor or Administrator must create a page before this block can use it.', 'slidey-panel'))
                );
            }
        } else {
            controls.push(
                el('p', null, __('Choose the default page used by Slidey Panel blocks.', 'slidey-panel'))
            );
        }

        return controls;
    }

    wp.blocks.registerBlockType('slidey-panel/panel', {
        icon: el(
            'svg',
            {
                xmlns: 'http://www.w3.org/2000/svg',
                viewBox: '0 0 24 24',
                'aria-hidden': 'true',
                focusable: 'false'
            },
            el('path', { d: 'M5 5v1.5h14V5H5zm0 7.8h14v-1.5H5v1.5zM5 19h14v-1.5H5V19z' })
        ),
        attributes: {
            title: {
                type: 'string',
                default: __('Slidey Panel', 'slidey-panel')
            },
            mode: {
                type: 'string',
                default: 'block'
            },
            buttonIcon: {
                type: 'string',
                default: 'title'
            },
            menuIcon: {
                type: 'string',
                default: 'menu'
            },
            justifyContent: {
                type: 'string'
            },
            style: {
                type: 'object'
            }
        },
        supports: {
            html: false,
            align: false,
            layout: false,
            color: {
                __experimentalSkipSerialization: true,
                text: true,
                background: true,
                gradients: true,
                link: true
            },
            typography: {
                __experimentalSkipSerialization: [
                    'fontSize',
                    'lineHeight',
                    'fontFamily',
                    'fontStyle',
                    'fontWeight',
                    'letterSpacing',
                    'textDecoration',
                    'textTransform'
                ],
                fontSize: true,
                lineHeight: true,
                fontFamily: true,
                fontStyle: true,
                fontWeight: true,
                letterSpacing: true,
                textDecoration: true,
                textTransform: true
            },
            spacing: {
                __experimentalSkipSerialization: true,
                padding: true
            },
            dimensions: {
                minHeight: true
            },
            __experimentalBorder: {
                __experimentalSkipSerialization: true,
                __experimentalDefaultControls: {
                    color: true,
                    radius: true,
                    style: true,
                    width: true
                },
                color: true,
                radius: true,
                style: true,
                width: true
            }
        },
        selectors: {
            root: '.wp-block-slidey-panel-panel .slidey-panel-open-button'
        },

        edit: function(props) {
            var attributes = props.attributes;
            var setAttributes = props.setAttributes;
            var contentState = useState({
                contentPosts: [],
                defaultContentId: 0,
                createContentUrl: '',
                canCreateContent: false,
                canManageDefaultContent: false,
                restNamespace: 'slidey-panel/v1',
                isLoading: true,
                isSaving: false
            });
            var contentData = contentState[0];
            var setContentData = contentState[1];
            var blockProps = useBlockProps({
                className: blockClassName(attributes)
            });
            var panelControls = [
                el(TextControl, {
                    label: __('Open Button Title', 'slidey-panel'),
                    value: attributes.title,
                    onChange: function(title) {
                        var nextAttributes = { title: title };

                        if ('' === title) {
                            nextAttributes.buttonIcon = 'icon';
                        }

                        setAttributes(nextAttributes);
                    }
                }),
                el(SelectControl, {
                    label: __('Open Button Display', 'slidey-panel'),
                    value: attributes.buttonIcon || 'title',
                    options: [
                        { label: __('Title only', 'slidey-panel'), value: 'title' },
                        { label: __('Icon', 'slidey-panel'), value: 'icon' },
                        { label: __('Icon to the left of title', 'slidey-panel'), value: 'left' },
                        { label: __('Icon to the right of title', 'slidey-panel'), value: 'right' }
                    ],
                    onChange: function(buttonIcon) {
                        setAttributes({ buttonIcon: buttonIcon });
                    }
                }),
                'title' !== (attributes.buttonIcon || 'title') && el(SelectControl, {
                    label: __('Hamburger Icon', 'slidey-panel'),
                    value: attributes.menuIcon || 'menu',
                    options: [
                        { label: __('Two lines', 'slidey-panel'), value: 'handle' },
                        { label: __('Three lines', 'slidey-panel'), value: 'menu' }
                    ],
                    onChange: function(menuIconValue) {
                        setAttributes({ menuIcon: menuIconValue });
                    }
                })
            ].concat(contentControls(contentData, setContentData));

            useEffect(function() {
                if ('block' !== attributes.mode) {
                    setAttributes({ mode: 'block' });
                }
            }, []);

            useEffect(function() {
                apiFetch({
                    path: '/' + contentData.restNamespace + '/content'
                }).then(function(response) {
                    setContentData(function(currentContentData) {
                        return Object.assign({}, currentContentData, {
                            contentPosts: response.contentPosts || [],
                            defaultContentId: response.defaultContentId || 0,
                            createContentUrl: response.createContentUrl || '',
                            canCreateContent: response.canCreateContent || false,
                            canManageDefaultContent: response.canManageDefaultContent || false,
                            restNamespace: response.restNamespace || currentContentData.restNamespace,
                            isLoading: false
                        });
                    });
                }).catch(function() {
                    setContentData(function(currentContentData) {
                        return Object.assign({}, currentContentData, { isLoading: false });
                    });
                });
            }, []);

            return el(
                wp.element.Fragment,
                null,
                el(
                    BlockControls,
                    null,
                    el(JustifyToolbar, {
                        allowedControls: ['left', 'center', 'right'],
                        value: attributes.justifyContent || 'left',
                        onChange: function(justifyContent) {
                            setAttributes({
                                justifyContent: !justifyContent || 'left' === justifyContent ? undefined : justifyContent
                            });
                        }
                    })
                ),
                el(
                    'div',
                    blockProps,
                    el(
                        'span',
                        editorButtonPreviewProps(attributes),
                        buttonContents(Object.assign({}, attributes, { title: editorButtonTitle(attributes) }))
                    )
                ),
                el(
                    InspectorControls,
                    null,
                    el(
                        PanelBody,
                        { title: __('Slidey Panel', 'slidey-panel'), initialOpen: true },
                        panelControls
                    )
                )
            );
        },

        save: function(props) {
            return slideyPanelButtonSave(Object.assign({}, props.attributes, { mode: 'block' }));
        }
    });
})(window.wp);
