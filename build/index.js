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
    var applyFilters = wp.hooks && wp.hooks.applyFilters
        ? wp.hooks.applyFilters
        : function(hookName, value) {
            return value;
        };
    var getBorderClassesAndStyles = wp.blockEditor.__experimentalGetBorderClassesAndStyles;
    var getColorClassesAndStyles = wp.blockEditor.__experimentalGetColorClassesAndStyles;
    var getSpacingClassesAndStyles = wp.blockEditor.__experimentalGetSpacingClassesAndStyles;
    var getTypographyClassesAndStyles = wp.blockEditor.getTypographyClassesAndStyles;

    function buttonTitle(attributes) {
        if ('undefined' === typeof attributes.title) {
            return __('SideMenu', 'sidemenu-block');
        }

        return attributes.title;
    }

    function editorButtonTitle(attributes) {
        if ('' === buttonTitle(attributes) && 'icon' !== (attributes.buttonIcon || 'title')) {
            return __('SideMenu', 'sidemenu-block');
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
                'sidemenu-open-button',
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

        props.className = classNames('sidemenu-editor-button-preview', props.className);

        if ('' === buttonTitle(attributes) && 'icon' !== (attributes.buttonIcon || 'title')) {
            props.style = mergeObjects(props.style, { color: '#757575' });
        }

        return props;
    }

    function menuIcon(attributes, context) {
        var icon = attributes.menuIcon || 'menu';
        var iconElement;

        if ('menu' === icon) {
            iconElement = el(
                'svg',
                {
                    className: 'sidemenu-button-icon',
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
                    className: 'sidemenu-button-icon',
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

        return applyFilters(
            'sidemenu.openButtonIcon',
            iconElement,
            attributes,
            context || 'save'
        );
    }

    function buttonContents(attributes, context) {
        var icon = attributes.buttonIcon || 'title';
        var title = buttonTitle(attributes);
        var contents = [];

        if ('icon' === icon || 'left' === icon) {
            contents.push(menuIcon(attributes, context));
        }

        if ('icon' !== icon) {
            contents.push(el('span', { className: 'sidemenu-button-title' }, title));
        }

        if ('right' === icon) {
            contents.push(menuIcon(attributes, context));
        }

        return contents;
    }

    function buttonLinkProps(attributes) {
        var title = buttonTitle(attributes);
        var linkProps = getButtonSupportProps(attributes);

        linkProps.href = '#';

        if ('icon' === (attributes.buttonIcon || 'title')) {
            linkProps['aria-label'] = title || __('Open menu', 'sidemenu-block');
        }

        return linkProps;
    }

    function blockClassName(attributes) {
        var justifyContent = attributes.justifyContent;

        return classNames(
            'sidemenu-block-mode',
            ('center' === justifyContent || 'right' === justifyContent)
                ? 'is-content-justification-' + justifyContent
                : ''
        );
    }

    function sidemenuButtonSave(attributes) {
        return el(
            'div',
            wp.blockEditor.useBlockProps.save({
                className: blockClassName(attributes),
                'data-sidemenu-mode': 'block'
            }),
            el(
                'a',
                buttonLinkProps(attributes),
                buttonContents(attributes)
            )
        );
    }

    function legacyBlockDivSave(attributes) {
        return el(
            'div',
            wp.blockEditor.useBlockProps.save({
                className: 'open_sidemenu sidemenu-block-mode',
                'data-sidemenu-mode': 'block'
            }),
            el('a', { href: '#' }, buttonTitle(attributes))
        );
    }

    function legacyBlockSpanSave(attributes) {
        return el(
            'span',
            {
                className: 'wp-block-sidemenu-sidemenu open_sidemenu sidemenu-block-mode',
                'data-sidemenu-mode': 'block'
            },
            el('a', { href: '#' }, buttonTitle(attributes))
        );
    }

    function contentPostById(contentPosts, contentId) {
        var contentIdInt = parseInt(contentId, 10);

        return contentPosts.find(function(contentPost) {
            return parseInt(contentPost.id, 10) === contentIdInt;
        });
    }

    function contentOptions(contentPosts) {
        return contentPosts.map(function(contentPost) {
            return {
                label: contentPost.title,
                value: String(contentPost.id)
            };
        });
    }

    function contentControls(contentState, setContentState) {
        var selectedContent = contentPostById(contentState.contentPosts, contentState.defaultContentId);
        var controls = [];

        if (contentState.isLoading) {
            return [el(Spinner)];
        }

        if (contentState.contentPosts.length > 1) {
            controls.push(
                el(SelectControl, {
                    label: __('Default SideMenu page', 'sidemenu-block'),
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

        if (selectedContent) {
            if (selectedContent.editLink) {
                controls.push(el(Button, {
                    href: selectedContent.editLink,
                    variant: 'secondary'
                }, __('Edit SideMenu Page', 'sidemenu-block')));
            } else {
                controls.push(
                    el('p', null, __('You can use this page, but an Editor or Administrator must edit it.', 'sidemenu-block'))
                );
            }
        } else if (!contentState.contentPosts.length) {
            if (contentState.canCreateContent && contentState.createContentUrl) {
                controls.push(el(Button, {
                    href: contentState.createContentUrl,
                    variant: 'primary'
                }, __('Add SideMenu Page', 'sidemenu-block')));
            } else {
                controls.push(
                    el('p', null, __('An Editor or Administrator must create a page before this block can use it.', 'sidemenu-block'))
                );
            }
        } else {
            controls.push(
                el('p', null, __('Choose the default page used by SideMenu blocks.', 'sidemenu-block'))
            );
        }

        return controls;
    }

    wp.blocks.registerBlockType('sidemenu-block/sidemenu', {
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
                default: __('SideMenu', 'sidemenu-block')
            },
            mode: {
                type: 'string',
                default: 'block'
            },
            contentId: {
                type: 'number'
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
            root: '.wp-block-sidemenu-block-sidemenu .sidemenu-open-button'
        },

        edit: function(props) {
            var attributes = props.attributes;
            var setAttributes = props.setAttributes;
            var contentState = useState({
                contentPosts: [],
                defaultContentId: 0,
                createContentUrl: '',
                canCreateContent: false,
                restNamespace: 'sidemenu/v1',
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
                    label: __('Open Button Title', 'sidemenu-block'),
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
                    label: __('Open Button Display', 'sidemenu-block'),
                    value: attributes.buttonIcon || 'title',
                    options: [
                        { label: __('Title only', 'sidemenu-block'), value: 'title' },
                        { label: __('Icon', 'sidemenu-block'), value: 'icon' },
                        { label: __('Icon to the left of title', 'sidemenu-block'), value: 'left' },
                        { label: __('Icon to the right of title', 'sidemenu-block'), value: 'right' }
                    ],
                    onChange: function(buttonIcon) {
                        setAttributes({ buttonIcon: buttonIcon });
                    }
                }),
                'title' !== (attributes.buttonIcon || 'title') && el(SelectControl, {
                    label: __('Hamburger Icon', 'sidemenu-block'),
                    value: attributes.menuIcon || 'menu',
                    options: [
                        { label: __('Two lines', 'sidemenu-block'), value: 'handle' },
                        { label: __('Three lines', 'sidemenu-block'), value: 'menu' }
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
                        buttonContents(Object.assign({}, attributes, { title: editorButtonTitle(attributes) }), 'editor')
                    )
                ),
                el(
                    InspectorControls,
                    null,
                    el(
                        PanelBody,
                        { title: __('SideMenu Open Button', 'sidemenu-block'), initialOpen: true },
                        panelControls
                    )
                )
            );
        },

        save: function(props) {
            return sidemenuButtonSave(Object.assign({}, props.attributes, { mode: 'block' }));
        },

        deprecated: [
            {
                attributes: {
                    title: {
                        type: 'string',
                        default: __('SideMenu', 'sidemenu-block')
                    },
                    mode: {
                        type: 'string'
                    },
                    contentId: {
                        type: 'number'
                    },
                    buttonIcon: {
                        type: 'string',
                        default: 'title'
                    },
                    menuIcon: {
                        type: 'string',
                        default: 'menu'
                    },
                    style: {
                        type: 'object'
                    }
                },
                save: function(props) {
                    return el(
                        'div',
                        wp.blockEditor.useBlockProps.save({
                            className: 'open_sidemenu sidemenu-block-mode',
                            'data-sidemenu-mode': 'block'
                        }),
                        el('a', buttonLinkProps(props.attributes), buttonContents(props.attributes))
                    );
                },
                isEligible: function(attributes) {
                    return 'block' === attributes.mode;
                },
                migrate: function(attributes) {
                    return Object.assign({}, attributes, {
                        title: buttonTitle(attributes),
                        mode: 'block',
                        buttonIcon: attributes.buttonIcon || 'title',
                        menuIcon: attributes.menuIcon || 'menu'
                    });
                }
            },
            {
                attributes: {
                    title: {
                        type: 'string',
                        default: __('SideMenu', 'sidemenu-block')
                    },
                    mode: {
                        type: 'string'
                    },
                    contentId: {
                        type: 'number'
                    },
                    buttonIcon: {
                        type: 'string',
                        default: 'title'
                    },
                    menuIcon: {
                        type: 'string',
                        default: 'menu'
                    }
                },
                save: function(props) {
                    return el(
                        'div',
                        wp.blockEditor.useBlockProps.save({
                            className: 'open_sidemenu sidemenu-block-mode',
                            'data-sidemenu-mode': 'block'
                        }),
                        el('a', buttonLinkProps(props.attributes), buttonContents(props.attributes))
                    );
                },
                isEligible: function(attributes) {
                    return 'block' === attributes.mode;
                },
                migrate: function(attributes) {
                    return {
                        title: buttonTitle(attributes),
                        mode: 'block',
                        buttonIcon: attributes.buttonIcon || 'title',
                        menuIcon: attributes.menuIcon || 'menu'
                    };
                }
            },
            {
                attributes: {
                    title: {
                        type: 'string',
                        default: __('SideMenu', 'sidemenu-block')
                    },
                    mode: {
                        type: 'string'
                    },
                    contentId: {
                        type: 'number'
                    }
                },
                save: function(props) {
                    return legacyBlockDivSave(props.attributes);
                },
                isEligible: function(attributes) {
                    return 'block' === attributes.mode;
                },
                migrate: function(attributes) {
                    return {
                        title: buttonTitle(attributes),
                        mode: 'block',
                        buttonIcon: 'title',
                        menuIcon: 'menu'
                    };
                }
            },
            {
                attributes: {
                    title: {
                        type: 'string',
                        default: __('SideMenu', 'sidemenu-block')
                    },
                    mode: {
                        type: 'string'
                    }
                },
                save: function(props) {
                    return legacyBlockSpanSave(props.attributes);
                },
                isEligible: function(attributes) {
                    return 'block' === attributes.mode;
                },
                migrate: function(attributes) {
                    return {
                        title: buttonTitle(attributes),
                        mode: 'block',
                        buttonIcon: 'title',
                        menuIcon: 'menu'
                    };
                }
            }
        ]
    });
})(window.wp);
