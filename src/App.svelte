<script>
    let price = 12.51;
    let tip = 15;

    function changeTip(newTip) {
        tip = newTip;
    }
</script>
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
            <input bind:value={price} type="number" id="price">
        </div>
    </section>
    <section class="row">
        <div class="column">
            <label for="tip">Tip ({tip}%)</label>
            <input bind:value={tip} type="range" min="0" max="100" step="1" id="tip">
        </div>
    </section>
    <section class="row">
        <div class="column">
            <button 
            class:button-outline={tip !== 15}
            on:click={() => changeTip(15)} 
                class="button">
                15%
            </button>
        </div>
        <div class="column">
            <button 
            class:button-outline={tip !== 25}
            on:click={() => changeTip(25)} 
            class="button">
                25%
            </button>
        </div>
        <div class="column">
            <button 
            class:button-outline={tip !== 30}
            on:click={() => changeTip(30)} 
            class="button">
                30%
            </button>
        </div>
    </section>
    <section class="row">
        <div class="column">
            <h2>Calculated Tip: $12.00</h2>
        </div>
    </section>
</main>