<?php

namespace Tests\Feature;

use Tests\TestCase;

class BuyingGuideTest extends TestCase
{
    public function test_the_public_buying_guide_is_available(): void
    {
        $response = $this->get('/buying-guide');

        $response->assertOk();
        $response->assertSee('User\\/Guide\\/Index', false);
    }
}
