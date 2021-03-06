/*!
 * jScrollPane - v2.0.0beta12-mgol - 2013-01-08
 * http://jscrollpane.kelvinluck.com/
 *
 * Copyright (c) 2010 Kelvin Luck
 * Copyright (c) 2013 Michał Z. Gołębiowski
 * Licensed under the MIT license.
 *
 * jQuery Versions - tested in 1.9.0+
 * Browsers Tested - Firefox 18, Safari 6, Opera 12.11, Chrome 23, IE 9, 10
 */

/*global escape: false, unescape: false */
(function ($) {
    'use strict';

    $.fn.jScrollPane = function (settings) {
        // JScrollPane "class" - public methods are available through $('selector').data('jsp')
        function JScrollPane(elem, s) {
            var settings, jsp = this, pane, paneWidth, paneHeight, container, contentWidth, contentHeight,
                percentInViewH, percentInViewV, isScrollableV, isScrollableH, verticalDrag, dragMaxY,
                verticalDragPosition, horizontalDrag, dragMaxX, horizontalDragPosition,
                verticalBar, verticalTrack, scrollbarWidth, verticalTrackHeight, verticalDragHeight,
                horizontalBar, horizontalTrack, horizontalTrackWidth, horizontalDragWidth,
                reinitializeInterval, originalPadding, originalPaddingTotalWidth, previousContentWidth,
                wasAtTop = true, wasAtLeft = true, wasAtBottom = false, wasAtRight = false,
                originalElement = elem.clone(false, false).empty(),
                mwEvent = $.fn.mwheelIntent ? 'mwheelIntent.jsp' : 'mousewheel.jsp';

            originalPadding = elem.css('paddingTop') + ' ' +
                elem.css('paddingRight') + ' ' +
                elem.css('paddingBottom') + ' ' +
                elem.css('paddingLeft');
            originalPaddingTotalWidth = (parseInt(elem.css('paddingLeft'), 10) || 0) +
                (parseInt(elem.css('paddingRight'), 10) || 0);

            function initialize(s) {
                var isMaintainingPositon, lastContentX, lastContentY,
                    hasContainingSpaceChanged, originalScrollTop, originalScrollLeft,
                    maintainAtBottom = false, maintainAtRight = false;

                settings = s;

                if (pane == null) {
                    originalScrollTop = elem.scrollTop();
                    originalScrollLeft = elem.scrollLeft();

                    if (!settings.disableHorizontal) {
                        elem.css({
                            overflowX: 'hidden',
                            padding: 0
                        });
                    }

                    if (!settings.disableVertical) {
                        elem.css({
                            overflowY: 'hidden',
                            padding: 0
                        });
                    }

                    // TODO: Deal with where width/ height is 0 as it probably means the element is hidden
                    // and we should come back to it later and check once it is unhidden...
                    paneWidth = elem.innerWidth();
                    paneHeight = elem.innerHeight();

                    elem.width(paneWidth);

                    pane = $('<div class="jspPane" />').css('padding', originalPadding).append(elem.children());
                    container = $('<div class="jspContainer" />')
                        .css({
                            width: paneWidth,
                            height: paneHeight
                        }
                    ).append(pane).appendTo(elem);
                } else {
                    elem.css('width', '');

                    maintainAtBottom = settings.stickToBottom && isCloseToBottom();
                    maintainAtRight = settings.stickToRight && isCloseToRight();

                    hasContainingSpaceChanged = elem.innerWidth() + originalPaddingTotalWidth !== paneWidth ||
                        elem.outerHeight() !== paneHeight;

                    if (hasContainingSpaceChanged) {
                        paneWidth = elem.innerWidth();
                        paneHeight = elem.innerHeight();
                        container.css({
                            width: paneWidth,
                            height: paneHeight
                        });
                    }

                    // If nothing changed since last check...
                    if (!hasContainingSpaceChanged && previousContentWidth === contentWidth &&
                        pane.outerHeight() === contentHeight) {
                        elem.width(paneWidth);
                        return;
                    }
                    previousContentWidth = contentWidth;

                    pane.css('width', '');
                    elem.width(paneWidth);

                    container.find('>.jspBar').remove().end();
                }

                pane.css('overflow', 'auto');
                if (s.contentWidth) {
                    contentWidth = s.contentWidth;
                } else {
                    contentWidth = pane[0].scrollWidth;
                }
                contentHeight = pane[0].scrollHeight;
                pane.css('overflow', '');

                percentInViewH = contentWidth / paneWidth;
                percentInViewV = contentHeight / paneHeight;
                isScrollableV = percentInViewV > 1 && !settings.disableVertical;

                isScrollableH = percentInViewH > 1 && !settings.disableHorizontal;

                if (!(isScrollableH || isScrollableV)) {
                    elem.removeClass('jspScrollable');
                    pane.css({
                        top: 0,
                        width: container.width() - originalPaddingTotalWidth
                    });
                    removeMousewheel();
                    removeFocusHandler();
                    removeKeyboardNav();
                    removeClickOnTrack();
                } else {
                    elem.addClass('jspScrollable');

                    isMaintainingPositon = settings.maintainPosition &&
                        (verticalDragPosition || horizontalDragPosition);
                    if (isMaintainingPositon) {
                        lastContentX = contentPositionX();
                        lastContentY = contentPositionY();
                    }

                    initializeVerticalScroll();
                    initializeHorizontalScroll();
                    resizeScrollbars();

                    if (isMaintainingPositon) {
                        scrollToX(maintainAtRight ? (contentWidth - paneWidth ) : lastContentX, false);
                        scrollToY(maintainAtBottom ? (contentHeight - paneHeight) : lastContentY, false);
                    }

                    initFocusHandler();
                    initMousewheel();

                    if (settings.enableKeyboardNavigation) {
                        initKeyboardNav();
                    }
                    if (settings.clickOnTrack) {
                        initClickOnTrack();
                    }

                    observeHash();
                    if (settings.hijackInternalLinks) {
                        hijackInternalLinks();
                    }
                }

                if (settings.autoReinitialize && !reinitializeInterval) {
                    reinitializeInterval = setInterval(
                        function () {
                            initialize(settings);
                        },
                        settings.autoReinitializeDelay
                    );
                } else if (!settings.autoReinitialize && reinitializeInterval) {
                    clearInterval(reinitializeInterval);
                }

                if (originalScrollTop) {
                    elem.scrollTop(0);
                    scrollToY(originalScrollTop, false);
                }
                if (originalScrollLeft) {
                    elem.scrollLeft(0);
                    scrollToX(originalScrollLeft, false);
                }

                elem.trigger('jsp-initialized', [isScrollableH || isScrollableV]);
            }

            function initializeVerticalScroll() {
                if (isScrollableV) {

                    container.append(
                        $('<div class="jspBar jspVerticalBar"></div>').append(
                            $('<div class="jspTrack"></div>').append(
                                $('<div class="jspDrag"></div>')
                            )
                        )
                    );

                    verticalBar = container.find('>.jspVerticalBar');
                    verticalTrack = verticalBar.find('>.jspTrack');
                    verticalDrag = verticalTrack.find('>.jspDrag');

                    verticalTrackHeight = paneHeight;

                    verticalDrag.hover(
                        function () {
                            verticalDrag.addClass('jspHover');
                        },
                        function () {
                            verticalDrag.removeClass('jspHover');
                        }
                    ).on(
                        'mousedown.jsp',
                        function (e) {
                            // Don't allow text selection.
                            $(document).on('dragstart.jsp selectstart.jsp', disableEvent);

                            verticalDrag.addClass('jspActive');

                            var startY = e.pageY - verticalDrag.position().top;

                            $(document).on(
                                'mousemove.jsp',
                                function (e) {
                                    positionDragY(e.pageY - startY, false);
                                }
                            ).on('mouseup.jsp mouseleave.jsp', cancelDrag);
                            return false;
                        }
                    );
                    sizeVerticalScrollbar();
                }
            }

            function sizeVerticalScrollbar() {
                verticalTrack.height(verticalTrackHeight + 'px');
                verticalDragPosition = 0;
                scrollbarWidth = settings.verticalGutter + verticalTrack.outerWidth();

                // Make the pane thinner to allow for the vertical scrollbar
                pane.width(paneWidth - scrollbarWidth - originalPaddingTotalWidth);

                // Add margin to the left of the pane if scrollbars are on that side (to position
                // the scrollbar on the left or right set it's left or right property in CSS)
                try {
                    if (verticalBar.position().left === 0) {
                        pane.css('margin-left', scrollbarWidth + 'px');
                    }
                } catch (err) {
                }
            }

            function initializeHorizontalScroll() {
                if (isScrollableH) {

                    container.append(
                        $('<div class="jspBar jspHorizontalBar"></div>').append(
                            $('<div class="jspTrack"></div>').append(
                                $('<div class="jspDrag"></div>')
                            )
                        )
                    );

                    horizontalBar = container.find('>.jspHorizontalBar');
                    horizontalTrack = horizontalBar.find('>.jspTrack');
                    horizontalDrag = horizontalTrack.find('>.jspDrag');

                    horizontalDrag.hover(
                        function () {
                            horizontalDrag.addClass('jspHover');
                        },
                        function () {
                            horizontalDrag.removeClass('jspHover');
                        }
                    ).on(
                        'mousedown.jsp',
                        function (e) {
                            // Don't allow text selection.
                            $(document).on('dragstart.jsp selectstart.jsp', disableEvent);

                            horizontalDrag.addClass('jspActive');

                            var startX = e.pageX - horizontalDrag.position().left;

                            $(document).on(
                                'mousemove.jsp',
                                function (e) {
                                    positionDragX(e.pageX - startX, false);
                                }
                            ).on('mouseup.jsp mouseleave.jsp', cancelDrag);
                            return false;
                        }
                    );
                    horizontalTrackWidth = container.innerWidth();
                    sizeHorizontalScrollbar();
                }
            }

            function sizeHorizontalScrollbar() {
                horizontalTrack.width(horizontalTrackWidth + 'px');
                horizontalDragPosition = 0;
            }

            function resizeScrollbars() {
                if (isScrollableH && isScrollableV) {
                    var horizontalTrackHeight = horizontalTrack.outerHeight(),
                        verticalTrackWidth = verticalTrack.outerWidth();
                    verticalTrackHeight -= horizontalTrackHeight;
                    horizontalTrackWidth -= verticalTrackWidth;
                    //noinspection JSSuspiciousNameCombination
                    paneHeight -= verticalTrackWidth;
                    //noinspection JSSuspiciousNameCombination
                    paneWidth -= horizontalTrackHeight;
                    horizontalTrack.parent().append(
                        $('<div class="jspCorner"></div>').css('width', horizontalTrackHeight + 'px')
                    );
                    sizeVerticalScrollbar();
                    sizeHorizontalScrollbar();
                }
                // reflow content
                if (isScrollableH) {
                    pane.width((container.outerWidth() - originalPaddingTotalWidth) + 'px');
                }
                contentHeight = pane.outerHeight();
                percentInViewV = contentHeight / paneHeight;

                if (isScrollableH) {
                    horizontalDragWidth = Math.ceil(1 / percentInViewH * horizontalTrackWidth);
                    if (horizontalDragWidth > settings.horizontalDragMaxWidth) {
                        horizontalDragWidth = settings.horizontalDragMaxWidth;
                    } else if (horizontalDragWidth < settings.horizontalDragMinWidth) {
                        horizontalDragWidth = settings.horizontalDragMinWidth;
                    }
                    horizontalDrag.width(horizontalDragWidth + 'px');
                    dragMaxX = horizontalTrackWidth - horizontalDragWidth;
                    _positionDragX(horizontalDragPosition); // To update the state.
                }
                if (isScrollableV) {
                    verticalDragHeight = Math.ceil(1 / percentInViewV * verticalTrackHeight);
                    if (verticalDragHeight > settings.verticalDragMaxHeight) {
                        verticalDragHeight = settings.verticalDragMaxHeight;
                    } else if (verticalDragHeight < settings.verticalDragMinHeight) {
                        verticalDragHeight = settings.verticalDragMinHeight;
                    }
                    verticalDrag.height(verticalDragHeight + 'px');
                    dragMaxY = verticalTrackHeight - verticalDragHeight;
                    _positionDragY(verticalDragPosition); // To update the state.
                }
            }

            function initClickOnTrack() {
                removeClickOnTrack();
                if (isScrollableV) {
                    verticalTrack.on(
                        'mousedown.jsp',
                        function (e) {
                            if (e.originalTarget == null || e.originalTarget === e.currentTarget) {
                                var clickedTrack = $(this),
                                    offset = clickedTrack.offset(),
                                    direction = e.pageY - offset.top - verticalDragPosition,
                                    scrollTimeout,
                                    isFirst = true,
                                    doScroll = function () {
                                        var offset = clickedTrack.offset(),
                                            pos = e.pageY - offset.top - verticalDragHeight / 2,
                                            contentDragY = paneHeight * settings.scrollPagePercent,
                                            dragY = dragMaxY * contentDragY / (contentHeight - paneHeight);
                                        if (direction < 0) {
                                            if (verticalDragPosition - dragY > pos) {
                                                jsp.scrollByY(-contentDragY);
                                            } else {
                                                positionDragY(pos);
                                            }
                                        } else if (direction > 0) {
                                            if (verticalDragPosition + dragY < pos) {
                                                jsp.scrollByY(contentDragY);
                                            } else {
                                                positionDragY(pos);
                                            }
                                        } else {
                                            cancelClick();
                                            return;
                                        }
                                        scrollTimeout = setTimeout(doScroll,
                                            isFirst ? settings.initialDelay : settings.trackClickRepeatFreq);
                                        isFirst = false;
                                    },
                                    cancelClick = function () {
                                        if (scrollTimeout) {
                                            clearTimeout(scrollTimeout);
                                        }
                                        scrollTimeout = null;
                                        $(document).off('mouseup.jsp', cancelClick);
                                    };
                                doScroll();
                                $(document).on('mouseup.jsp', cancelClick);
                                return false;
                            }
                            return true;
                        }
                    );
                }

                if (isScrollableH) {
                    horizontalTrack.on(
                        'mousedown.jsp',
                        function (e) {
                            if (e.originalTarget == null || e.originalTarget === e.currentTarget) {
                                var clickedTrack = $(this),
                                    offset = clickedTrack.offset(),
                                    direction = e.pageX - offset.left - horizontalDragPosition,
                                    scrollTimeout,
                                    isFirst = true,
                                    doScroll = function () {
                                        var offset = clickedTrack.offset(),
                                            pos = e.pageX - offset.left - horizontalDragWidth / 2,
                                            contentDragX = paneWidth * settings.scrollPagePercent,
                                            dragX = dragMaxX * contentDragX / (contentWidth - paneWidth);
                                        if (direction < 0) {
                                            if (horizontalDragPosition - dragX > pos) {
                                                jsp.scrollByX(-contentDragX);
                                            } else {
                                                positionDragX(pos);
                                            }
                                        } else if (direction > 0) {
                                            if (horizontalDragPosition + dragX < pos) {
                                                jsp.scrollByX(contentDragX);
                                            } else {
                                                positionDragX(pos);
                                            }
                                        } else {
                                            cancelClick();
                                            return;
                                        }
                                        scrollTimeout = setTimeout(doScroll,
                                            isFirst ? settings.initialDelay : settings.trackClickRepeatFreq);
                                        isFirst = false;
                                    },
                                    cancelClick = function () {
                                        if (scrollTimeout) {
                                            clearTimeout(scrollTimeout);
                                        }
                                        scrollTimeout = null;
                                        $(document).off('mouseup.jsp', cancelClick);
                                    };
                                doScroll();
                                $(document).on('mouseup.jsp', cancelClick);
                                return false;
                            }
                            return true;
                        }
                    );
                }
            }

            function removeClickOnTrack() {
                if (horizontalTrack) {
                    horizontalTrack.off('mousedown.jsp');
                }
                if (verticalTrack) {
                    verticalTrack.off('mousedown.jsp');
                }
            }

            function cancelDrag() {
                $(document).off('dragstart.jsp selectstart.jsp mousemove.jsp mouseup.jsp mouseleave.jsp');

                if (verticalDrag) {
                    verticalDrag.removeClass('jspActive');
                }
                if (horizontalDrag) {
                    horizontalDrag.removeClass('jspActive');
                }
            }

            function positionDragY(destY, animate) {
                if (!isScrollableV) {
                    return;
                }
                if (destY < 0) {
                    destY = 0;
                } else if (destY > dragMaxY) {
                    destY = dragMaxY;
                }

                // can't just check if(animate) because false is a valid value that could be passed in...
                if (animate == null) {
                    animate = settings.animateScroll;
                }
                if (animate) {
                    jsp.animate(verticalDrag, 'top', destY, _positionDragY);
                } else {
                    verticalDrag.css('top', destY);
                    _positionDragY(destY);
                }

            }

            function _positionDragY(destY) {
                if (destY == null) {
                    destY = verticalDrag.position().top;
                }

                container.scrollTop(0);
                verticalDragPosition = destY;

                var isAtTop = verticalDragPosition === 0,
                    isAtBottom = verticalDragPosition === dragMaxY,
                    percentScrolled = destY / dragMaxY,
                    destTop = -percentScrolled * (contentHeight - paneHeight);

                if (wasAtTop !== isAtTop || wasAtBottom !== isAtBottom) {
                    wasAtTop = isAtTop;
                    wasAtBottom = isAtBottom;
                }

                pane.css('top', destTop);
                elem.trigger('jsp-scroll-y', [-destTop, isAtTop, isAtBottom]).trigger('scroll');
            }

            function positionDragX(destX, animate) {
                if (!isScrollableH) {
                    return;
                }
                if (destX < 0) {
                    destX = 0;
                } else if (destX > dragMaxX) {
                    destX = dragMaxX;
                }

                if (animate == null) {
                    animate = settings.animateScroll;
                }
                if (animate) {
                    jsp.animate(horizontalDrag, 'left', destX, _positionDragX);
                } else {
                    horizontalDrag.css('left', destX);
                    _positionDragX(destX);
                }
            }

            function _positionDragX(destX) {
                if (destX == null) {
                    destX = horizontalDrag.position().left;
                }

                container.scrollTop(0);
                horizontalDragPosition = destX;

                var isAtLeft = horizontalDragPosition === 0,
                    isAtRight = horizontalDragPosition === dragMaxX,
                    percentScrolled = destX / dragMaxX,
                    destLeft = -percentScrolled * (contentWidth - paneWidth);

                if (wasAtLeft !== isAtLeft || wasAtRight !== isAtRight) {
                    wasAtLeft = isAtLeft;
                    wasAtRight = isAtRight;
                }

                pane.css('left', destLeft);
                elem.trigger('jsp-scroll-x', [-destLeft, isAtLeft, isAtRight]).trigger('scroll');
            }

            function scrollToY(destY, animate) {
                var percentScrolled = destY / (contentHeight - paneHeight);
                positionDragY(percentScrolled * dragMaxY, animate);
            }

            function scrollToX(destX, animate) {
                var percentScrolled = destX / (contentWidth - paneWidth);
                positionDragX(percentScrolled * dragMaxX, animate);
            }

            function scrollToElement(ele, stickToTop, animate) {
                var e, eleHeight, eleWidth, eleTop = 0, eleLeft = 0, viewportTop, viewportLeft,
                    maxVisibleEleTop, maxVisibleEleLeft, destY, destX;

                // Legal hash values aren't necessarily legal jQuery selectors so we need to catch any
                // errors from the lookup...
                try {
                    e = $(ele);
                } catch (err) {
                    return;
                }
                eleHeight = e.outerHeight();
                eleWidth = e.outerWidth();

                container.scrollTop(0);
                container.scrollLeft(0);

                // loop through parents adding the offset top of any elements that are relatively positioned between
                // the focused element and the jspPane so we can get the true distance from the top
                // of the focused element to the top of the scrollpane...
                while (!e.is('.jspPane')) {
                    eleTop += e.position().top;
                    eleLeft += e.position().left;
                    e = e.offsetParent();
                    if (/^body|html$/i.test(e[0].nodeName)) {
                        // we ended up too high in the document structure. Quit!
                        return;
                    }
                }

                viewportTop = contentPositionY();
                maxVisibleEleTop = viewportTop + paneHeight;
                if (eleTop < viewportTop || stickToTop) { // element is above viewport
                    destY = eleTop - settings.verticalGutter;
                } else if (eleTop + eleHeight > maxVisibleEleTop) { // element is below viewport
                    destY = eleTop - paneHeight + eleHeight + settings.verticalGutter;
                }
                if (destY) {
                    scrollToY(destY, animate);
                }

                viewportLeft = contentPositionX();
                maxVisibleEleLeft = viewportLeft + paneWidth;
                if (eleLeft < viewportLeft || stickToTop) { // element is to the left of viewport
                    destX = eleLeft - settings.horizontalGutter;
                } else if (eleLeft + eleWidth > maxVisibleEleLeft) { // element is to the right viewport
                    destX = eleLeft - paneWidth + eleWidth + settings.horizontalGutter;
                }
                if (destX) {
                    scrollToX(destX, animate);
                }

            }

            function contentPositionX() {
                return -pane.position().left;
            }

            function contentPositionY() {
                return -pane.position().top;
            }

            function isCloseToBottom() {
                var scrollableHeight = contentHeight - paneHeight;
                return (scrollableHeight > 20) && (scrollableHeight - contentPositionY() < 10);
            }

            function isCloseToRight() {
                var scrollableWidth = contentWidth - paneWidth;
                return (scrollableWidth > 20) && (scrollableWidth - contentPositionX() < 10);
            }

            function initMousewheel() {
                container.off(mwEvent).on(
                    mwEvent,
                    function (event, delta, deltaX, deltaY) {
                        var dX, dY;
                        dX = horizontalDragPosition;
                        dY = verticalDragPosition;
                        jsp.scrollBy(deltaX * settings.mouseWheelSpeed, -deltaY * settings.mouseWheelSpeed, false);
                        // return true if there was no movement so rest of screen can scroll
                        return dX === horizontalDragPosition && dY === verticalDragPosition;
                    }
                );
            }

            function removeMousewheel() {
                container.off(mwEvent);
            }

            function disableEvent() {
                return false;
            }

            function initFocusHandler() {
                pane.find(':input,a').off('focus.jsp').on(
                    'focus.jsp', function (e) {
                        scrollToElement(e.target, false);
                    }
                );
            }

            function removeFocusHandler() {
                pane.find(':input,a').off('focus.jsp');
            }

            function initKeyboardNav() {
                var keyDown, elementHasScrolled, validParents = [];
                if (isScrollableH) {
                    validParents.push(horizontalBar[0]);
                }
                if (isScrollableV) {
                    validParents.push(verticalBar[0]);
                }

                // IE also focuses elements that don't have tabindex set.
                pane.focus(function () {
                    elem.focus();
                });

                elem.attr('tabindex', 0)
                    .off('keydown.jsp keypress.jsp')
                    .on(
                    'keydown.jsp',
                    function (e) {
                        if (e.target !== this && !(validParents.length && $(e.target).closest(validParents).length)) {
                            return false;
                        }
                        var dX, dY;
                        dX = horizontalDragPosition;
                        dY = verticalDragPosition;
                        switch (e.keyCode) {
                            case 40: // down
                            case 38: // up
                            case 34: // page down
                            case 32: // space
                            case 33: // page up
                            case 39: // right
                            case 37: // left
                                keyDown = e.keyCode;
                                keyDownHandler();
                                break;
                            case 35: // end
                                scrollToY(contentHeight - paneHeight);
                                keyDown = null;
                                break;
                            case 36: // home
                                scrollToY(0);
                                keyDown = null;
                                break;
                        }

                        elementHasScrolled = e.keyCode === keyDown &&
                            dX !== horizontalDragPosition || dY !== verticalDragPosition;
                        return !elementHasScrolled;
                    }
                ).on(
                    'keypress.jsp', // For FF/ OSX so that we can cancel the repeat key presses if the JSP scrolls...
                    function (e) {
                        if (e.keyCode === keyDown) {
                            keyDownHandler();
                        }
                        return !elementHasScrolled;
                    }
                );

                if (settings.hideFocus) {
                    elem.css('outline', 'none');
                    if ('hideFocus' in container[0]) {
                        elem.attr('hideFocus', true);
                    }
                } else {
                    elem.css('outline', '');
                    if ('hideFocus' in container[0]) {
                        elem.attr('hideFocus', false);
                    }
                }

                function keyDownHandler() {
                    var dX, dY;
                    dX = horizontalDragPosition;
                    dY = verticalDragPosition;
                    switch (keyDown) {
                        case 40: // down
                            jsp.scrollByY(settings.keyboardSpeed, false);
                            break;
                        case 38: // up
                            jsp.scrollByY(-settings.keyboardSpeed, false);
                            break;
                        case 34: // page down
                        case 32: // space
                            jsp.scrollByY(paneHeight * settings.scrollPagePercent, false);
                            break;
                        case 33: // page up
                            jsp.scrollByY(-paneHeight * settings.scrollPagePercent, false);
                            break;
                        case 39: // right
                            jsp.scrollByX(settings.keyboardSpeed, false);
                            break;
                        case 37: // left
                            jsp.scrollByX(-settings.keyboardSpeed, false);
                            break;
                    }

                    elementHasScrolled = dX !== horizontalDragPosition || dY !== verticalDragPosition;
                    return elementHasScrolled;
                }
            }

            function removeKeyboardNav() {
                elem.attr('tabindex', '-1')
                    .removeAttr('tabindex')
                    .off('keydown.jsp keypress.jsp');
            }

            function observeHash() {
                if (location.hash && location.hash.length > 1) {
                    var e,
                        retryInt,
                        hash = escape(location.hash.substr(1)); // hash must be escaped to prevent XSS
                    try {
                        e = $('#' + hash + ', a[name="' + hash + '"]');
                    } catch (err) {
                        return;
                    }

                    if (e.length && pane.find(hash)) {
                        // nasty workaround but it appears to take a little while before the hash has done its thing
                        // to the rendered page so we just wait until the container's scrollTop has been messed up.
                        if (container.scrollTop() === 0) {
                            retryInt = setInterval(
                                function () {
                                    if (container.scrollTop() > 0) {
                                        scrollToElement(e, true);
                                        $(document).scrollTop(container.position().top);
                                        clearInterval(retryInt);
                                    }
                                },
                                50
                            );
                        } else {
                            scrollToElement(e, true);
                            $(document).scrollTop(container.position().top);
                        }
                    }
                }
            }

            function hijackInternalLinks() {
                // only register the link handler once
                if ($(document.body).data('jspHijack')) {
                    return;
                }

                // remember that the handler was bound
                $(document.body).data('jspHijack', true);

                // use live handler to also capture newly created links
                $(document.body).on('click', 'a[href*=#]', function (event) {
                    // does the link point to the same page?
                    // this also takes care of cases with a <base>-Tag or Links not starting with the hash #
                    // e.g. <a href="index.html#test"> when the current url already is index.html
                    var href = this.href.substr(0, this.href.indexOf('#')),
                        locationHref = location.href,
                        hash,
                        element,
                        container,
                        jsp,
                        scrollTop,
                        elementTop;
                    if (location.href.indexOf('#') !== -1) {
                        locationHref = location.href.substr(0, location.href.indexOf('#'));
                    }
                    if (href !== locationHref) {
                        // the link points to another page
                        return;
                    }

                    // check if jScrollPane should handle this click event
                    hash = escape(this.href.substr(this.href.indexOf('#') + 1));

                    // find the element on the page
                    try {
                        element = $('#' + hash + ', a[name="' + hash + '"]');
                    } catch (e) {
                        // hash is not a valid jQuery identifier
                        return;
                    }

                    if (!element.length) {
                        // this link does not point to an element on this page
                        return;
                    }

                    container = element.closest('.jspScrollable');
                    jsp = container.data('jsp');

                    // jsp might be another jsp instance than the one, that bound this event
                    // remember: this event is only bound once for all instances.
                    jsp.scrollToElement(element, true);

                    if (container[0].scrollIntoView) {
                        // also scroll to the top of the container (if it is not visible)
                        scrollTop = $(window).scrollTop();
                        elementTop = element.offset().top;
                        if (elementTop < scrollTop || elementTop > scrollTop + $(window).height()) {
                            container[0].scrollIntoView();
                        }
                    }

                    // jsp handled this event, prevent the browser default (scrolling :P)
                    event.preventDefault();
                });
            }

            function destroy() {
                var currentY = contentPositionY(),
                    currentX = contentPositionX();
                elem.removeClass('jspScrollable').off('.jsp');
                elem.replaceWith(originalElement.append(pane.children()));
                originalElement.scrollTop(currentY);
                originalElement.scrollLeft(currentX);

                // clear reinitialize timer if active
                if (reinitializeInterval) {
                    clearInterval(reinitializeInterval);
                }
            }

            // Public API
            $.extend(
                jsp,
                {
                    // Reinitializes the scroll pane (if it's internal dimensions have changed since the last time it
                    // was initialized). The settings object which is passed in will override any settings from the
                    // previous time it was initialized - if you don't pass any settings then the ones from the previous
                    // initialisation will be used.
                    reinitialize: function (s) {
                        s = $.extend({}, settings, s);
                        initialize(s);
                    },
                    // Scrolls the specified element (a jQuery object, DOM node or jQuery selector string) into view so
                    // that it can be seen within the viewport. If stickToTop is true then the element will appear at
                    // the top of the viewport, if it is false then the viewport will scroll as little as possible to
                    // show the element. You can also specify if you want animation to occur. If you don't provide this
                    // argument then the animateScroll value from the settings object is used instead.
                    scrollToElement: function (ele, stickToTop, animate) {
                        scrollToElement(ele, stickToTop, animate);
                    },
                    // Scrolls the pane so that the specified co-ordinates within the content are at the top left
                    // of the viewport. animate is optional and if not passed then the value of animateScroll from
                    // the settings object this jScrollPane was initialized with is used.
                    scrollTo: function (destX, destY, animate) {
                        scrollToX(destX, animate);
                        scrollToY(destY, animate);
                    },
                    // Scrolls the pane so that the specified co-ordinate within the content is at the left of the
                    // viewport. animate is optional and if not passed then the value of animateScroll from the settings
                    // object this jScrollPane was initialized with is used.
                    scrollToX: function (destX, animate) {
                        scrollToX(destX, animate);
                    },
                    // Scrolls the pane so that the specified co-ordinate within the content is at the top of the
                    // viewport. animate is optional and if not passed then the value of animateScroll from the settings
                    // object this jScrollPane was initialized with is used.
                    scrollToY: function (destY, animate) {
                        scrollToY(destY, animate);
                    },
                    // Scrolls the pane to the specified percentage of its maximum horizontal scroll position. animate
                    // is optional and if not passed then the value of animateScroll from the settings object this
                    // jScrollPane was initialized with is used.
                    scrollToPercentX: function (destPercentX, animate) {
                        scrollToX(destPercentX * (contentWidth - paneWidth), animate);
                    },
                    // Scrolls the pane to the specified percentage of its maximum vertical scroll position. animate
                    // is optional and if not passed then the value of animateScroll from the settings object this
                    // jScrollPane was initialized with is used.
                    scrollToPercentY: function (destPercentY, animate) {
                        scrollToY(destPercentY * (contentHeight - paneHeight), animate);
                    },
                    // Scrolls the pane by the specified amount of pixels. animate is optional and if not passed then
                    // the value of animateScroll from the settings object this jScrollPane was initialized with is used.
                    scrollBy: function (deltaX, deltaY, animate) {
                        jsp.scrollByX(deltaX, animate);
                        jsp.scrollByY(deltaY, animate);
                    },
                    // Scrolls the pane by the specified amount of pixels. animate is optional and if not passed then
                    // the value of animateScroll from the settings object this jScrollPane was initialized with is used.
                    scrollByX: function (deltaX, animate) {
                        var destX = contentPositionX() + Math[deltaX < 0 ? 'floor' : 'ceil'](deltaX),
                            percentScrolled = destX / (contentWidth - paneWidth);
                        positionDragX(percentScrolled * dragMaxX, animate);
                    },
                    // Scrolls the pane by the specified amount of pixels. animate is optional and if not passed then
                    // the value of animateScroll from the settings object this jScrollPane was initialized with is used.
                    scrollByY: function (deltaY, animate) {
                        var destY = contentPositionY() + Math[deltaY < 0 ? 'floor' : 'ceil'](deltaY),
                            percentScrolled = destY / (contentHeight - paneHeight);
                        positionDragY(percentScrolled * dragMaxY, animate);
                    },
                    // Positions the horizontal drag at the specified x position (and updates the viewport to reflect
                    // this). animate is optional and if not passed then the value of animateScroll from the settings
                    // object this jScrollPane was initialized with is used.
                    positionDragX: function (x, animate) {
                        positionDragX(x, animate);
                    },
                    // Positions the vertical drag at the specified y position (and updates the viewport to reflect
                    // this). animate is optional and if not passed then the value of animateScroll from the settings
                    // object this jScrollPane was initialized with is used.
                    positionDragY: function (y, animate) {
                        positionDragY(y, animate);
                    },
                    // This method is called when jScrollPane is trying to animate to a new position. You can override
                    // it if you want to provide advanced animation functionality. It is passed the following arguments:
                    //  * ele          - the element whose position is being animated
                    //  * prop         - the property that is being animated
                    //  * value        - the value it's being animated to
                    //  * stepCallback - a function that you must execute each time you update the value of the property
                    // You can use the default implementation (below) as a starting point for your own implementation.
                    animate: function (ele, prop, value, stepCallback) {
                        var params = {};
                        params[prop] = value;
                        ele.animate(params, {
                            duration: settings.animateDuration,
                            easing: settings.animateEase,
                            queue: false,
                            step: stepCallback
                        });
                    },
                    // Returns the current x position of the viewport with regards to the content pane.
                    getContentPositionX: function () {
                        return contentPositionX();
                    },
                    // Returns the current y position of the viewport with regards to the content pane.
                    getContentPositionY: function () {
                        return contentPositionY();
                    },
                    // Returns the width of the content within the scroll pane.
                    getContentWidth: function () {
                        return contentWidth;
                    },
                    // Returns the height of the content within the scroll pane.
                    getContentHeight: function () {
                        return contentHeight;
                    },
                    // Returns the horizontal position of the viewport within the pane content.
                    getPercentScrolledX: function () {
                        return contentPositionX() / (contentWidth - paneWidth);
                    },
                    // Returns the vertical position of the viewport within the pane content.
                    getPercentScrolledY: function () {
                        return contentPositionY() / (contentHeight - paneHeight);
                    },
                    // Returns whether or not this scrollpane has a horizontal scrollbar.
                    getIsScrollableH: function () {
                        return isScrollableH;
                    },
                    // Returns whether or not this scrollpane has a vertical scrollbar.
                    getIsScrollableV: function () {
                        return isScrollableV;
                    },
                    // Gets a reference to the content pane. It is important that you use this method if you want to
                    // edit the content of your jScrollPane as if you access the element directly then you may have some
                    // problems (as your original element has had additional elements for the scrollbars etc added into
                    // it).
                    getContentPane: function () {
                        return pane;
                    },
                    // Scrolls this jScrollPane down as far as it can currently scroll. If animate isn't passed then the
                    // animateScroll value from settings is used instead.
                    scrollToBottom: function (animate) {
                        positionDragY(dragMaxY, animate);
                    },
                    // Hijacks the links on the page which link to content inside the scrollpane. If you have changed
                    // the content of your page (e.g. via AJAX) and want to make sure any new anchor links to the
                    // contents of your scroll pane will work then call this function.
                    hijackInternalLinks: $.noop,
                    // Removes the jScrollPane and returns the page to the state it was in before jScrollPane was
                    // initialized.
                    destroy: function () {
                        destroy();
                    }
                }
            );

            initialize(s);
        }

        // Pluginifying code...
        settings = $.extend({}, $.fn.jScrollPane.defaults, settings);

        // Apply default speed
        $.each(['mouseWheelSpeed', 'trackClickSpeed', 'keyboardSpeed'], function () {
            settings[this] = settings[this] || settings.speed;
        });

        return this.each(
            function () {
                var elem = $(this), jspApi = elem.data('jsp');
                if (jspApi) {
                    jspApi.reinitialize(settings);
                } else {
                    $('script', elem).filter('[type="text/javascript"],:not([type])').remove();
                    jspApi = new JScrollPane(elem, settings);
                    elem.data('jsp', jspApi);
                }
            }
        );
    };

    $.fn.jScrollPane.defaults = {
        maintainPosition: true,
        stickToBottom: false,
        stickToRight: false,
        clickOnTrack: true,
        autoReinitialize: false,
        autoReinitializeDelay: 500,
        verticalDragMinHeight: 0,
        verticalDragMaxHeight: 99999,
        horizontalDragMinWidth: 0,
        horizontalDragMaxWidth: 99999,
        contentWidth: undefined,
        animateScroll: false,
        animateDuration: 300,
        animateEase: 'linear',
        hijackInternalLinks: false,
        verticalGutter: 4,
        horizontalGutter: 4,
        mouseWheelSpeed: 0,
        trackClickSpeed: 0,
        trackClickRepeatFreq: 70,
        enableKeyboardNavigation: true,
        hideFocus: false,
        keyboardSpeed: 0,
        initialDelay: 300, // Delay before starting repeating
        speed: 30, // Default speed when others falsey
        scrollPagePercent: 0.8    // Percent of visible area scrolled when pageUp/Down or track area pressed
    };

})(jQuery);
