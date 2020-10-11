<style>
    h1 {
        text-align: center;
    }
    h2 {
        text-align: center;
        margin-top: 20px;
    }
    #tip {
        width: 100%;
    }
    button {
        width: 100%;
    }
</style>
<main class="container">
    <section class="row">
        <div class="column">
            <h1>Tip Calculator</h1>
        </div>
    </section>
    <section class="row">
        <div class="column">
            <label for="price">Price</label>
            <input type="number" id="price">
        </div>
    </section>
    <section class="row">
        <div class="column">
            <label for="tip">Tip (15%)</label>
            <input type="range" min="0" max="100" step="1" id="tip">
        </div>
    </section>
    <section class="row">
        <div class="column">
            <button class="button button-outline">
                15%
            </button>
        </div>
        <div class="column">
            <button class="button button-outline">
                25%
            </button>
        </div>
        <div class="column">
            <button class="button button-outline">
                30%
            </button>
        </div>
    </section>
    <section class="row">
        <div class="column">
            <h2>Calculator Tip: $12.00</h2>
        </div>
    </section>
</main>