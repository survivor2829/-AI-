Component({
  properties: {
    state: {
      type: String,
      value: 'half',
    },
    featured: {
      type: Array,
      value: [],
    },
    groups: {
      type: Array,
      value: [],
    },
    safeBottom: {
      type: Number,
      value: 0,
    },
    halfHeight: {
      type: Number,
      value: 304,
    },
  },

  data: {
    touchStartY: 0,
  },

  methods: {
    onOpen() {
      this.triggerEvent('statechange', { state: 'full' });
    },

    onClose() {
      this.triggerEvent('close');
    },

    onSelect(event) {
      const { item } = event.currentTarget.dataset;
      this.triggerEvent('select', { item });
    },

    onTouchStart(event) {
      const touch = event.touches && event.touches[0];
      if (touch) {
        this.setData({ touchStartY: touch.pageY });
      }
    },

    onTouchEnd(event) {
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;

      const distance = touch.pageY - this.data.touchStartY;
      if (distance < -42) {
        this.triggerEvent('statechange', { state: 'full' });
      } else if (distance > 42) {
        this.triggerEvent('statechange', { state: 'collapsed' });
      }
    },

    stopTouchMove() {},
  },
});
