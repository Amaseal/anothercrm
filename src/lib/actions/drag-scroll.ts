export function dragScroll(node: HTMLElement) {
    let isDown = false;
    let startX: number;
    let scrollLeft: number;

    function mouseDown(e: MouseEvent) {
        // If the user clicks on something that should handle its own drag (like a card), ignore.
        if (
            (e.target as HTMLElement).closest('button') ||
            (e.target as HTMLElement).closest('a') ||
            (e.target as HTMLElement).closest('input') ||
            (e.target as HTMLElement).closest('[data-drag-handle]')
        ) {
            return;
        }

        isDown = true;
        // We don't need to add cursor-move here if it's already on the node.
        // However, preventing user select is good.
        node.classList.add('select-none'); // Tailwind class for user-select: none

        startX = e.pageX - node.offsetLeft;
        scrollLeft = node.scrollLeft;
    }

    function mouseLeave() {
        isDown = false;
        node.classList.remove('select-none');
    }

    function mouseUp() {
        isDown = false;
        node.classList.remove('select-none');
    }

    function mouseMove(e: MouseEvent) {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - node.offsetLeft;
        const walk = (x - startX) * 1.5; // Scroll-fast
        node.scrollLeft = scrollLeft - walk;
    }

    node.addEventListener('mousedown', mouseDown);
    node.addEventListener('mouseleave', mouseLeave);
    node.addEventListener('mouseup', mouseUp);
    node.addEventListener('mousemove', mouseMove);

    // Initial state
    node.classList.add('cursor-move');

    // Ensure we clean up
    return {
        destroy() {
            node.removeEventListener('mousedown', mouseDown);
            node.removeEventListener('mouseleave', mouseLeave);
            node.removeEventListener('mouseup', mouseUp);
            node.removeEventListener('mousemove', mouseMove);
            node.classList.remove('cursor-move');
            node.classList.remove('select-none');
        }
    };
}
